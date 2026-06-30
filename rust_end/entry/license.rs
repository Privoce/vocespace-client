use std::{fmt::Display, str::FromStr};

use chrono::Utc;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use sea_orm::{prelude::StringLen, *};
use serde::{Deserialize, Serialize};

const LICENSE_SECRET: &str = "privoce_vocespace_secret_key";

/// JWT Claims for license
#[derive(Debug, Serialize, Deserialize)]
pub struct LicenseClaims {
    /// Subject (email)
    pub email: String,
    /// Expiration time (Unix timestamp)
    pub expires_at: i64,
    /// Created at (Unix timestamp)
    pub created_at: i64,
    /// License domains
    pub domains: String,
    /// License limit/tier
    pub limit: String,
    /// License ID
    pub id: String,
}

impl LicenseClaims {
    pub fn new(
        email: String,
        expires_at: i64,
        created_at: i64,
        domains: String,
        limit: String,
        id: String,
    ) -> Self {
        Self {
            email,
            expires_at,
            created_at,
            domains,
            limit,
            id,
        }
    }
    pub fn create_license(self) -> String {
        let secret = LICENSE_SECRET.to_string();
        let encoding_key = EncodingKey::from_secret(secret.as_bytes());
        let header = Header::new(Algorithm::HS256);

        encode(&header, &self, &encoding_key).unwrap_or_else(|err| {
            eprintln!("Failed to generate JWT license: {}", err);
            format!("vocespace_fallback_{}", self.email)
        })
    }

    pub fn validate(&self) -> bool {
        let now = Utc::now().timestamp();
        self.expires_at > now && self.created_at <= now
    }
}

impl FromStr for LicenseClaims {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let secret = LICENSE_SECRET.to_string();

        let decoding_key = DecodingKey::from_secret(secret.as_bytes());
        let validation = Validation::new(Algorithm::HS256);

        match decode::<LicenseClaims>(s, &decoding_key, &validation) {
            Ok(token_data) => Ok(token_data.claims),
            Err(err) => Err(format!("Failed to parse license: {}", err)),
        }
    }
}

/// # Table for license
/// | key        | type        |
/// | ---------- | ----------- |
/// | id         | i32         |
/// | email      | String      |
/// | domains    | String      |
/// | created_at | Timestamp   |
/// | expires_at | Timestamp   |
/// | value      | String      |
/// | limit      | Limit       | (String in database)
#[derive(Debug, Clone, PartialEq, DeriveEntityModel, serde::Serialize)]
#[sea_orm(table_name = "license")]
pub struct Model {
    /// primary key (use uuid)
    #[sea_orm(primary_key)]
    pub id: String,
    pub email: String,
    // /// signed is true if the license is signed
    // /// if is false, means the user may use the free test version
    // pub signed: bool,
    /// real is Vec<String> use `,` to split
    /// for example: `"hello.world.com, hello2.world.com"`
    pub domains: String,
    /// created_at is the time when the license is created (timestamp)
    pub created_at: i64,
    /// expires_at is the time when the license is expired (timestamp)
    pub expires_at: i64,
    /// license value (token)
    pub value: String,
    pub ilimit: Limit,
}

impl Model {
    pub fn new(email: String, domains: String, created_at: i64) -> Self {
        let expires_at = created_at + 60 * 60 * 24 * 365; // 1 year
        let id = uuid::Uuid::new_v4().to_string();
        let ilimit = Limit::Professional;
        let value = Self::generate_license_value(
            &id,
            &email,
            &domains,
            created_at,
            expires_at,
            ilimit.to_string(),
        );
        Self {
            id,
            email,
            domains,
            created_at,
            expires_at,
            value,
            ilimit,
        }
    }
    pub fn domains(&self) -> Vec<String> {
        self.domains.split(',').map(|s| s.to_string()).collect()
    }
    /// ## check if the license is expired
    /// check expores_at < now
    pub fn is_valid(&self) -> bool {
        let now = Utc::now().timestamp();
        return self.expires_at > now;
    }
    /// check the license table is exists, if not, create it (sqlite)
    pub fn check_table_or_create() -> Statement {
        let sql = "CREATE TABLE IF NOT EXISTS license (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            domains TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            value TEXT NOT NULL,
            ilimit TEXT NOT NULL
        )";

        Statement::from_string(DbBackend::Sqlite, sql.to_string())
    }

    pub fn generate_license_value(
        id: &str,
        email: &str,
        domains: &str,
        timestamp: i64,
        expires_at: i64,
        limit: String,
    ) -> String {
        let claims = LicenseClaims {
            email: email.to_string(),
            expires_at,
            created_at: timestamp,
            domains: domains.to_string(),
            limit,
            id: id.to_string(),
        };
        claims.create_license()
    }

    /// 解析 JWT license 获取 Claims
    pub fn parse_license_claims(license_value: &str) -> Result<LicenseClaims, String> {
        LicenseClaims::from_str(license_value)
    }

    /// 验证 license 是否有效（包括过期检查和签名验证）
    pub fn validate_license(license_value: &str) -> Result<LicenseClaims, String> {
        let claims = Self::parse_license_claims(license_value)?;

        claims
            .validate()
            .then(|| ())
            .ok_or("License is invalid or expired".to_string())?;

        Ok(claims)
    }

    pub fn to_active_model(self) -> ActiveModel {
        ActiveModel {
            id: Set(self.id),
            email: Set(self.email),
            domains: Set(self.domains),
            created_at: Set(self.created_at),
            expires_at: Set(self.expires_at),
            value: Set(self.value),
            ilimit: Set(self.ilimit),
        }
    }
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

/// Limit for license
/// different license types have different limits which cost different
/// - free: free license
/// - pro: professional license
/// - enterprise: enterprise license
#[derive(Debug, Clone, Copy, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "String(StringLen::N(12))")]
pub enum Limit {
    #[sea_orm(string_value = "free")]
    Free,
    #[sea_orm(string_value = "pro")]
    Professional,
    #[sea_orm(string_value = "enterprise")]
    Enterprise,
}

impl Display for Limit {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Limit::Free => "free",
            Limit::Professional => "pro",
            Limit::Enterprise => "enterprise",
        })
    }
}

impl serde::Serialize for Limit {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod test_license {
    use super::*;

    #[test]
    fn test_license_generation_and_validation() {
        let email = "han@privoce.com";
        let domains = "*";
        let created_at = 1747742400;
        let expires_at = created_at + 60 * 60 * 24 * 365;
        let limit = Limit::Professional.to_string();
        let id = uuid::Uuid::new_v4().to_string();

        // 生成 license
        let license = LicenseClaims::new(
            email.to_string(),
            expires_at,
            created_at,
            domains.to_string(),
            limit,
            id,
        );
        let license_value = license.create_license();
        dbg!("Generated License Value: {}", license_value);
    }

    #[test]
    fn free_license() {
        let email = "han@privoce.com";
        let domains = "*";
        let created_at = 1735660800;
        let expires_at = 4891334400;
        let limit = Limit::Free.to_string();
        let id = uuid::Uuid::new_v4().to_string();

        // 生成 license
        let license = LicenseClaims::new(
            email.to_string(),
            expires_at,
            created_at,
            domains.to_string(),
            limit,
            id,
        );
        let license_value = license.create_license();
        dbg!("Generated License Value: {}", license_value);
    }
}
