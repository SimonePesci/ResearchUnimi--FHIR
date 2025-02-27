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


    // Data associated with every person
    struct PersonalData {
        string name;
        string surname;
        string taxCode;
    }
    
    mapping(uint256 => mapping(uint256 => HospitalAccess[])) public tokenHospitalAccessRights; // Role , tokenID -> hospitalAccess
    mapping(uint256 => mapping(uint256 => PersonalData)) public tokenPersonalData;  // Role , tokenID -> personalData
    mapping(uint256 => mapping(uint256 => address)) private addressTokenPossession; // Role , tokenID -> address
    mapping(address => mapping(uint256 => uint256)) private tokenPossession; //  address , Role -> tokenID

    uint256 private tokenIdDoctor = 0;
    uint256 private tokenIdPatient = 0;
    uint256 private tokenIdAssistant = 0;

    // Single mint function for all token types
    function mint(uint256 tokenType, address account, string memory name, string memory surname, string calldata taxCode) public onlyOwner {
        require(tokenType == Doctor || tokenType == Patient || tokenType == Assistant, "Invalid token type");
        require(balanceOf(account, tokenType) == 0, "This address already owns this token type.");
        
        uint256 tokenId;
        if (tokenType == Doctor) {
            tokenIdDoctor++;
            tokenId = tokenIdDoctor;
        } else if (tokenType == Patient) {
            tokenIdPatient++;
            tokenId = tokenIdPatient;
        } else if (tokenType == Assistant) {
            tokenIdAssistant++;
            tokenId = tokenIdAssistant;
        }
        
        _mint(account, tokenType, 1, "");
        tokenPersonalData[tokenType][tokenId] = PersonalData(name, surname, taxCode);
        tokenPossession[account][tokenType] = tokenId;
        addressTokenPossession[tokenType][tokenId] = account;
    }

    // Function used to retrieve information about the last user minted
    function getLastMintedUser(uint256 tokenType, address accountOwner) public view returns (address account, uint256 tokenId, string memory name, string memory surname, string memory taxCode) {
        uint256 tokenID;
        require(balanceOf(accountOwner, tokenType) > 0, "Address does not own this token type.");

        tokenID = tokenPossession[accountOwner][tokenType];

        return (accountOwner, tokenID, tokenPersonalData[tokenType][tokenID].name, tokenPersonalData[tokenType][tokenID].surname, tokenPersonalData[tokenType][tokenID].taxCode);
    }

    // Function used to update hospital access rights for a specific token instance
    function setHospitalAccess(uint256 tokenType, uint256 tokenID, uint256 hospitalId, bytes memory accessRights) public onlyOwner {
        address owner = addressTokenPossession[tokenType][tokenID];
        require(owner != address(0), "Token does not exist or has no owner.");

        // Find and update the specific hospital access rights for the given token instance
        bool hospitalFound = false;
        for (uint256 i = 0; i < tokenHospitalAccessRights[tokenType][tokenID].length; i++) {
            if (tokenHospitalAccessRights[tokenType][tokenID][i].hospitalId == hospitalId) {
                tokenHospitalAccessRights[tokenType][tokenID][i].accessRights = accessRights;
                hospitalFound = true;
                break;
            }
        }

        // If the hospital ID is not found, add a new entry
        if (!hospitalFound) {
            tokenHospitalAccessRights[tokenType][tokenID].push(HospitalAccess({
                hospitalId: hospitalId,
                accessRights: accessRights
            }));
        }
    }

    // Checks if the permission is granted for the specified hospital
    function checkPermission(uint256 tokenType, uint256 tokenID, uint256 hospitalId, uint8 permission) public view returns (bool) {
        for (uint256 i = 0; i < tokenHospitalAccessRights[tokenType][tokenID].length; i++) {
            if (tokenHospitalAccessRights[tokenType][tokenID][i].hospitalId == hospitalId) {
                bytes memory accessRights = tokenHospitalAccessRights[tokenType][tokenID][i].accessRights;
                return (uint8(accessRights[0]) & permission) == permission;
            }
        }
        return false;
    }

    // Returns the access rights for a specified hospital associated with a specific token
    function getHospitalPermissions(uint256 tokenType, uint256 tokenID, uint256 hospitalId) public view returns (bytes memory) {
        address owner = addressTokenPossession[tokenType][tokenID];
        require(owner != address(0), "Token does not exist or has no owner.");

        for (uint256 i = 0; i < tokenHospitalAccessRights[tokenType][tokenID].length; i++) {
            if (tokenHospitalAccessRights[tokenType][tokenID][i].hospitalId == hospitalId) {
                return tokenHospitalAccessRights[tokenType][tokenID][i].accessRights;
            }
        }
        // Return an empty byte array if no permissions are set or if the hospitalId is not found
        return new bytes(0);
    }

    function getAddressForToken(uint256 tokenType, uint256 tokenID) public view returns (address) {
        address owner = addressTokenPossession[tokenType][tokenID];
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
