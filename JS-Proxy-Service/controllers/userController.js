const blockchainService = require("../services/blockchainService");
const catchAsync = require("../utils/catchAsync");

/**
 * Handles user creation.
 */
exports.createUser = catchAsync(async (req, res) => {
  const { userType, address, name, surname, taxCode } = req.body;

  await blockchainService.createUserOnBlockchain(
    userType,
    address,
    name,
    surname,
    taxCode
  );

  res.status(201).json({
    message: "User created successfully on the blockchain.",
  });
});
