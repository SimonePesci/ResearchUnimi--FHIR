const emrService = require("../services/emrServices");

exports.updateEMR = async (req, res) => {
  try {
    // Extract contracts from req
    const contracts = {
      web3: req.web3,
      merkleTreeContract: req.merkleTreeContract,
      hospitalTokenContract: req.hospitalTokenContract,
      owner: req.owner,
    };

    // Pass contracts to service function
    const updateResults = await emrService.updateEMR(contracts, req.body);
    res.json(updateResults);
  } catch (error) {
    console.error("Error updating EMR:", error);
    res.status(500).json({ success: false, message: error.toString() });
  }
};

exports.accessEMR = async (req, res) => {
  try {
    const contracts = {
      web3: req.web3,
      merkleTreeContract: req.merkleTreeContract,
      hospitalTokenContract: req.hospitalTokenContract,
      owner: req.owner,
    };

    const accessResults = await emrService.accessEMR(contracts, req.body);
    res.json(accessResults);
  } catch (error) {
    console.error("Error accessing EMR:", error);
    res.status(500).json({ success: false, message: error.toString() });
  }
};

exports.addNewEMR = async (req, res) => {
  try {
    const contracts = {
      web3: req.web3,
      merkleTreeContract: req.merkleTreeContract,
      hospitalTokenContract: req.hospitalTokenContract,
      owner: req.owner,
    };

    const addResults = await emrService.addNewEMR(contracts, req.body);
    res.json(addResults);
  } catch (error) {
    console.error("Error adding new EMR:", error);
    res.status(500).json({ success: false, message: error.toString() });
  }
};

exports.checkIntegrity = async (req, res) => {
  try {
    const contracts = {
      merkleTreeContract: req.merkleTreeContract,
    };

    const { EMR_id } = req.body;

    if (!EMR_id) {
      return res
        .status(400)
        .json({ success: false, message: "EMR_id is required" });
    }

    const result = await emrService.checkIntegrity(contracts, EMR_id);
    res.json(result);
  } catch (error) {
    console.error("Error checking integrity:", error);
    res.status(500).json({ success: false, message: error.toString() });
  }
};
