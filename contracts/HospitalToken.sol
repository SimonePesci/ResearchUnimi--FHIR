// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../node_modules/@openzeppelin/contracts/utils/Strings.sol";

contract HospitalToken is ERC1155 {
    using Strings for uint256;

    uint256 constant Doctor = 1;
    uint256 constant Patient = 2;
    uint256 constant Assistant = 3;

    address private _owner;

    modifier onlyOwner() {
        require(msg.sender == _owner, "Caller is not the owner");
        _;
    }

    constructor() ERC1155("https://ipfs.io/ipfs/bafybeihjjkwdrxxjnuwevlqtqmh3iegcadc32sio4wmo7bv2gbf34qs34a/{id}.json") {
        _owner = msg.sender; // The owner is set as the deployer of the contract
    }

    // Access rights within each Hospital
    struct HospitalAccess {
        uint256 hospitalId;
        bytes accessRights;
    }


    mapping(uint256 => mapping(uint256 => HospitalAccess[])) public tokenHospitalAccessRights; // Role , tokenID -> hospitalAccess
    mapping(uint256 => mapping(uint256 => address)) private addressTokenPossession; // Role , tokenID -> address
    mapping(address => mapping(uint256 => uint256)) private tokenPossession; //  address , Role -> tokenID

    uint256 private tokenIdDoctor = 0;
    uint256 private tokenIdPatient = 0;
    uint256 private tokenIdAssistant = 0;

    // Single mint function for all roles
    function mint(uint256 role, address account) public onlyOwner {
        require(role == Doctor || role == Patient || role == Assistant, "Invalid role");
        require(balanceOf(account, role) == 0, "This address already owns this role.");
        
        uint256 tokenId;
        if (role == Doctor) {
            tokenIdDoctor++;
            tokenId = tokenIdDoctor;
        } else if (role == Patient) {
            tokenIdPatient++;
            tokenId = tokenIdPatient;
        } else if (role == Assistant) {
            tokenIdAssistant++;
            tokenId = tokenIdAssistant;
        }
        
        _mint(account, role, 1, "");
        tokenPossession[account][role] = tokenId;
        addressTokenPossession[role][tokenId] = account;
    }

    // Function used to retrieve information about the last user minted
    function getLastMintedUser(uint256 role, address accountOwner) public view returns (address account, uint256 tokenId) {
        uint256 tokenID;
        require(balanceOf(accountOwner, role) > 0, "Address does not own this role.");

        tokenID = tokenPossession[accountOwner][role];

        return (accountOwner, tokenID);
    }

    // Function used to update hospital access rights for a specific token instance
    function setHospitalAccess(uint256 role, uint256 tokenID, uint256 hospitalId, bytes memory accessRights) public onlyOwner {
        address owner = addressTokenPossession[role][tokenID];
        require(owner != address(0), "Token does not exist or has no owner.");

        // Find and update the specific hospital access rights for the given token instance
        bool hospitalFound = false;
        for (uint256 i = 0; i < tokenHospitalAccessRights[role][tokenID].length; i++) {
            if (tokenHospitalAccessRights[role][tokenID][i].hospitalId == hospitalId) {
                tokenHospitalAccessRights[role][tokenID][i].accessRights = accessRights;
                hospitalFound = true;
                break;
            }
        }

        // If the hospital ID is not found, add a new entry
        if (!hospitalFound) {
            tokenHospitalAccessRights[role][tokenID].push(HospitalAccess({
                hospitalId: hospitalId,
                accessRights: accessRights
            }));
        }
    }

    // Checks if the permission is granted for the specified hospital
    function checkPermission(uint256 role, uint256 tokenID, uint256 hospitalId, uint8 permission) public view returns (bool) {
        for (uint256 i = 0; i < tokenHospitalAccessRights[role][tokenID].length; i++) {
            if (tokenHospitalAccessRights[role][tokenID][i].hospitalId == hospitalId) {
                bytes memory accessRights = tokenHospitalAccessRights[role][tokenID][i].accessRights;
                return (uint8(accessRights[0]) & permission) == permission;
            }
        }
        return false;
    }

    // Returns the access rights for a specified hospital associated with a specific token
    function getHospitalPermissions(uint256 role, uint256 tokenID, uint256 hospitalId) public view returns (bytes memory) {
        address owner = addressTokenPossession[role][tokenID];
        require(owner != address(0), "Token does not exist or has no owner.");

        for (uint256 i = 0; i < tokenHospitalAccessRights[role][tokenID].length; i++) {
            if (tokenHospitalAccessRights[role][tokenID][i].hospitalId == hospitalId) {
                return tokenHospitalAccessRights[role][tokenID][i].accessRights;
            }
        }
        // Return an empty byte array if no permissions are set or if the hospitalId is not found
        return new bytes(0);
    }

    function getAddressForToken(uint256 role, uint256 tokenID) public view returns (address) {
        address owner = addressTokenPossession[role][tokenID];
        require(owner != address(0), "Token does not exist or has no owner.");
        return owner;
    }

    // Function to transfer ownership
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner is the zero address");
        _owner = newOwner;
    }

    // Function to retrieve the current owner
    function owner() public view returns (address) {
        return _owner;
    }
}

