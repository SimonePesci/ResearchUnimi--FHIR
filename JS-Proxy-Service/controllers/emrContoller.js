const emrService = require("../services/emrServices");
const catchAsync = require("../utils/catchAsync");

exports.updateEMR = catchAsync(async (req, res) => {
  const updateResults = await emrService.updateEMR(req.body);
  res.json(updateResults);
});

exports.accessEMR = catchAsync(async (req, res) => {
  const accessResults = await emrService.accessEMR(req.body);
  res.json(accessResults);
});

exports.addNewEMR = catchAsync(async (req, res) => {
  const addResults = await emrService.addNewEMR(req.body);
  res.json(addResults);
});

exports.checkIntegrity = catchAsync(async (req, res) => {
  const { EMR_id } = req.body;

  if (!EMR_id) {
    return res
      .status(400)
      .json({ success: false, message: "EMR_id is required" });
  }

  const result = await emrService.checkIntegrity(EMR_id);
  res.json(result);
});
