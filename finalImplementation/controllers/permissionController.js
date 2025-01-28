// controllers/permissionController.js
const permissionService = require("../services/permissionService");

/**
 * Assigns permissions to a user.
 */
exports.assignPermission = async (req, res) => {
  const { userType, tokenID, hospitalID, permission } = req.body;
  const contracts = {
    hospitalTokenContract: req.hospitalTokenContract,
    owner: req.owner,
  };

  try {
    await permissionService.assignPermission(contracts, {
      userType,
      tokenID,
      hospitalID,
      permissions: permission,
    });
    res.json({ success: true, message: "Permission assigned successfully" });
  } catch (error) {
    console.error("Error assigning permission:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Verifies permissions for a user.
 */
exports.verifyPermissions = async (req, res) => {
  const { userType, tokenID, hospitalID, permissions } = req.query;
  const contracts = {
    hospitalTokenContract: req.hospitalTokenContract,
    owner: req.owner,
  };

  try {
    const verified = await permissionService.verifyPermissions(contracts, {
      userType,
      tokenID,
      hospitalID,
      permissions,
    });
    res.json({ success: true, verified });
  } catch (error) {
    console.error("Error verifying permissions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
