const permissionService = require("../services/permissionService");
const catchAsync = require("../utils/catchAsync");

exports.assignPermission = catchAsync(async (req, res) => {
  const { userType, tokenID, hospitalID, permission } = req.body;
  await permissionService.assignPermission({
    userType,
    tokenID,
    hospitalID,
    permissions: permission,
  });
  res.json({ success: true, message: "Permission assigned successfully" });
});

exports.verifyPermissions = catchAsync(async (req, res) => {
  const { userType, tokenID, hospitalID, permissions } = req.query;
  const verified = await permissionService.verifyPermissions({
    userType,
    tokenID,
    hospitalID,
    permissions,
  });
  res.json({ success: true, verified });
});
