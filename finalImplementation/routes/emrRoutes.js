const express = require("express");
const router = express.Router();
const emrController = require("../controllers/emrContoller");

router.post("/update-emr", emrController.updateEMR);
router.post("/access-emr", emrController.accessEMR);
router.post("/add-new-emr", emrController.addNewEMR);
router.post("/check-integrity", emrController.checkIntegrity);

module.exports = router;
