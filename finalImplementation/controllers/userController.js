// controllers/userController.js
const blockchainService = require("../services/blockchainService");

/**
 * Handles user creation.
 */
exports.createUser = async (req, res) => {
  const { userType, address, name, surname, taxCode } = req.body;
  const contracts = {
    web3: req.web3,
    merkleTreeContract: req.merkleTreeContract,
    hospitalTokenContract: req.hospitalTokenContract,
    owner: req.owner,
  };

  try {
    const userData = await blockchainService.createUserOnBlockchain(
      contracts,
      userType,
      address,
      name,
      surname,
      taxCode
    );

    res.status(201).json({
      message: "User created successfully on the blockchain.",
      //   data: userData,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      message: "Failed to create user on the blockchain.",
      error: error.message,
    });
  }
};
