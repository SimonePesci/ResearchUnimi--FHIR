// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract MerkleTree {
    // --- PROPERTIES ---- //

    // Calculated from EMRs in EMRValues.json
    bytes32 public merkleRoot = 
        0xb750bb6ce7580380afdf3510ed8100dd91242d9bebf2596423b461f215efd5ef;
        

    // --- FUNCTIONS ---- //

    function verify (
        bytes32 leaf,
        bytes32[] memory proof

    ) public view returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
        bytes32 proofElement = proof[i];

        if (computedHash <= proofElement) {
            // Hash(current computed hash + current element of the proof)
            computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
        } else {
            // Hash(current element of the proof + current computed hash)
            computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
        }
        }

        // Check if the computed hash (root) is equal to the provided root
        return computedHash == merkleRoot;
    }


    function updateMerkleRoot(bytes32 newRoot) public returns (bool) {
            merkleRoot = newRoot;
            return true;
    }



}