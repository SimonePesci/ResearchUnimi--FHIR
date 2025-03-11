const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");

router.post("/assign-permission", permissionController.assignPermission);
router.get("/verify-permissions", permissionController.verifyPermissions);

module.exports = router;
