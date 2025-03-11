const keccak256 = require("keccak256");

exports.hashPermissions = (permissions) => {
  return "0x" + keccak256(JSON.stringify(permissions)).toString("hex");
};
