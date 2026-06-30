use std::io::Write;

use crate::{
    db,
    entry::{self},
    error::{ApiError, ApiResult, ErrCode},
};

use salvo::{handler, writing::Json, Request, Response};
use sea_orm::{ActiveModelTrait, ActiveValue::Set, ColumnTrait, EntityTrait, QueryFilter};

use super::smtp::{fmt_content_buy, send_email};

#[derive(Debug, Clone, serde::Deserialize)]
pub struct LicenseReq {
    email: String,
    created_at: i64,
    domains: String,
}

/// create a new license (POST /api/license)
#[handler]
pub async fn create_license(req: &mut Request, res: &mut Response) -> ApiResult<()> {
    let license_req: LicenseReq = req
        .parse_json()
        .await
        .map_err(|_| ApiError::new(ErrCode::InvalidRequest, "Invalid request".to_string()))?;

    // create a license model
    let license = entry::license::Model::new(
        license_req.email,
        license_req.domains,
        license_req.created_at,
    );

    let license_value = license.value.clone();
    let license_email = license.email.clone();
    let license = license.to_active_model();
    let mut insert_success = false;
    // store in db
    let db = db::connect().await;
    match license.insert(&db).await {
        Ok(model) => {
            insert_success = true;
            // 插入成功，可以返回新创建的 license ID
            res.render(Json(serde_json::json!({
                "success": true,
                "license_id": model.id,
                "msg": "License created successfully"
            })));
        }
        Err(err) => {
            // 检查错误类型
            if err.to_string().contains("RecordNotFound") {
                insert_success = true;
                // 这种情况下实际上记录可能已经被插入，只是无法检索
                res.render(Json(serde_json::json!({
                    "success": true,
                    "msg": "License likely created but couldn't be retrieved",
                    "warning": err.to_string()
                })));
            } else {
                // 真正的错误
                return Err(ApiError::new(
                    ErrCode::DatabaseError,
                    format!("Failed to create license: {}", err),
                ));
            }
        }
    }

    if insert_success {
        // 通过smtp服务发送邮件给用户，告知用户license已创建并附上license
        let send_success = send_email("han@privoce.com", "", &license_email, "VoceSpace License", &fmt_content_buy(&license_value));
        if !send_success {
            // record to log
            if let Ok(exe_path) = std::env::current_exe() {
                let log_file = exe_path.join("vocespace_buy_email.log");
                let mut file = std::fs::OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(log_file)
                    .unwrap();
                // append the log
                let log_entry = format!(
                    "Failed to send email to {} with license value {}.\n",
                    license_email, license_value
                );
                file.write_all(log_entry.as_bytes())
                    .unwrap_or_else(|e| eprintln!("Failed to write to log file: {}", e));
            } else {
                eprintln!("Failed to get current executable path");
            }
        }
    }

    // res.render(Json());
    Ok(())
}

/// get license info by domain value (GET /api/license/domains/${value})
#[handler]
pub async fn get_license_by_domain(req: &mut Request, res: &mut Response) -> ApiResult<()> {
    // 从路径中获取 "value" 参数
    let license_value = req.param::<String>("value").ok_or_else(|| {
        ApiError::new(ErrCode::InvalidRequest, "Missing license value".to_string())
    })?;

    let db = db::connect().await;
    // 查询数据库
    match entry::license::Entity::find()
        .filter(entry::license::Column::Domains.eq(license_value))
        .one(&db)
        .await
    {
        Ok(Some(license)) => {
            if license.is_valid() {
                // back license
                res.render(Json(license));
            } else {
                // license expired
                res.render(Json(ApiError::new(
                    ErrCode::LicenseExpired,
                    "License expired".to_string(),
                )));
            }
        }
        Ok(None) => {
            // license not found
            res.render(Json(ApiError::new(
                ErrCode::LicenseNotFound,
                "License not found".to_string(),
            )));
        }
        Err(e) => {
            // the license not exists
            res.render(Json(ApiError::new(
                ErrCode::DatabaseError,
                format!("Failed to get license: {}", e),
            )));
        }
    }

    Ok(())
}   

/// get license info by license value (GET /api/license/${value})
/// user will send a license value, and we should check if the license is valid
#[handler]
pub async fn get_license(req: &mut Request, res: &mut Response) -> ApiResult<()> {
    // 从路径中获取 "value" 参数
    let license_value = req.param::<String>("value").ok_or_else(|| {
        ApiError::new(ErrCode::InvalidRequest, "Missing license value".to_string())
    })?;

    let db = db::connect().await;
    // 查询数据库
    match entry::license::Entity::find()
        .filter(entry::license::Column::Value.eq(license_value))
        .one(&db)
        .await
    {
        Ok(Some(license)) => {
            if license.is_valid() {
                // back license
                res.render(Json(license));
            } else {
                // license expired
                res.render(Json(ApiError::new(
                    ErrCode::LicenseExpired,
                    "License expired".to_string(),
                )));
            }
        }
        Ok(None) => {
            // license not found
            res.render(Json(ApiError::new(
                ErrCode::LicenseNotFound,
                "License not found".to_string(),
            )));
        }
        Err(e) => {
            // the license not exists
            res.render(Json(ApiError::new(
                ErrCode::DatabaseError,
                format!("Failed to get license: {}", e),
            )));
        }
    }

    Ok(())
}

/// clear all licenses (DELETE /api/license)
/// this api only use for test , should not be used in production
#[handler]
pub async fn clear_license(_req: &mut Request, res: &mut Response) -> ApiResult<()> {
    let db = db::connect().await;
    // delete all licenses
    match entry::license::Entity::delete_many().exec(&db).await {
        Ok(_) => {
            res.render(Json(serde_json::json!({
                "success": true,
                "msg": "All licenses deleted successfully"
            })));
        }
        Err(e) => {
            res.render(Json(ApiError::new(
                ErrCode::DatabaseError,
                format!("Failed to delete licenses: {}", e),
            )));
        }
    }

    Ok(())
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct LicenseChangeReq {
    email: String,
    value: String,
    pub new_domains: String,
    pub new_email: String,
}

/// update license if exists (PUT /api/license)
/// user may need to change domains or email after the license is created
/// this should be [`LicenseChangeReq`] instead of [`LicenseReq`]
#[handler]
pub async fn update_license(req: &mut Request, res: &mut Response) -> ApiResult<()> {
    let license_change_req: LicenseChangeReq = req
        .parse_json()
        .await
        .map_err(|_| ApiError::new(ErrCode::InvalidRequest, "Invalid request".to_string()))?;

    // check if the license exists
    let db = db::connect().await;
    match entry::license::Entity::find()
        .filter(entry::license::Column::Value.eq(license_change_req.value))
        .filter(entry::license::Column::Email.eq(license_change_req.email))
        .one(&db)
        .await
    {
        Ok(Some(license)) => {
            let origin_domains = license.domains.clone();
            let origin_email = license.email.clone();
            // update the license
            let mut license_active = license.to_active_model();
            if !license_change_req.new_domains.is_empty()
                && license_change_req.new_domains != origin_domains
            {
                license_active.domains = Set(license_change_req.new_domains);
            }

            if !license_change_req.new_email.is_empty()
                && license_change_req.new_email != origin_email
            {
                license_active.email = Set(license_change_req.new_email);
            }

            match license_active.update(&db).await {
                Ok(updated_license) => {
                    res.render(Json(serde_json::json!({
                        "success": true,
                        "license_id": updated_license.id,
                        "msg": "License updated successfully"
                    })));
                }
                Err(err) => {
                    res.render(Json(ApiError::new(
                        ErrCode::DatabaseError,
                        format!("Failed to update license: {}", err),
                    )));
                }
            }
        }
        Ok(None) => {
            // license not found
            res.render(Json(ApiError::new(
                ErrCode::LicenseNotFound,
                "License not found".to_string(),
            )));
        }
        Err(e) => {
            // the license not exists
            res.render(Json(ApiError::new(
                ErrCode::DatabaseError,
                format!("Failed to get license: {}", e),
            )));
        }
    }

    Ok(())
}
