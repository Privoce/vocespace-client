export enum UserInfoErrMsg {
  USER_NOT_FOUND = "User not found",
  USER_CREATE_FAILED = "Failed to create user",
  USER_UPDATE_FAILED = "Failed to update user",
  USER_DELETE_FAILED = "Failed to delete user",
  UNAUTHORIZED = "Unauthorized",
  FORBIDDEN = "Forbidden",
  INVALID_INPUT = "Invalid input",
  INTERNAL_ERROR = "Internal server error",
}

export enum VocespaceError {
  CREATE_SPACE_PARAM_LACK = "common.create_space.error.param",
  CREATE_SPACE_EXIST = "common.create_space.error.exist",
}

export enum BucketApiErrMsg {
  FILE_NO_EXT = "error.bucket.fileNoExt",

}

export interface ApiErrMsg {
  userInfo: UserInfoErrMsg;
  vocespace: VocespaceError;
  bucket: BucketApiErrMsg;
}

export interface ApiErr {
  msg: ApiErrMsg;
  other: Error | string;
}
