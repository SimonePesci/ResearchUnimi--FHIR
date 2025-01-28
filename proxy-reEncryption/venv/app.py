from umbral import SecretKey, Signer, encrypt, decrypt_original, generate_kfrags, reencrypt, decrypt_reencrypted

# Patient's keys
patient_secret_key = SecretKey.random()
patient_public_key = patient_secret_key.public_key()

patient_signing_key = SecretKey.random()
patient_signer = Signer(patient_signing_key)
patient_verifying_key = patient_signing_key.public_key()

# Doctor 1's keys
doctor1_secret_key = SecretKey.random()
doctor1_public_key = doctor1_secret_key.public_key()

# Doctor 2's keys
doctor2_secret_key = SecretKey.random()
doctor2_public_key = doctor2_secret_key.public_key()

# Encrypt data with Alice's public key.
plaintext = b'Proxy Re-Encryption is cool!'
capsule, ciphertext = encrypt(patient_public_key, plaintext)
print(f"capsule {capsule}")
print(f"ciphertext {ciphertext}")

# Patient can decrypt the data with their secret key (for verification).
original_plaintext = decrypt_original(patient_secret_key, capsule, ciphertext)
print(f"clear {original_plaintext}")

# Generate KFrags for Doctor 1
kfrags_doctor1 = generate_kfrags(delegating_sk=patient_secret_key,
                                 receiving_pk=doctor1_public_key,
                                 signer=patient_signer,
                                 threshold=10,
                                 shares=20)

# Generate KFrags for Doctor 2
kfrags_doctor2 = generate_kfrags(delegating_sk=patient_secret_key,
                                 receiving_pk=doctor2_public_key,
                                 signer=patient_signer,
                                 threshold=10,
                                 shares=20)

# Re-encryption for Doctor 1
cfrags_doc1 = list()           # Bob's cfrag collection
for kfrag in kfrags_doctor1[:10]:
    cfrag = reencrypt(capsule=capsule, kfrag=kfrag)
    cfrags_doc1.append(cfrag)    # Bob collects a cfrag

# Re-encryption for Doctor 2
cfrags_doc2 = list()           # Bob's cfrag collection
for kfrag in kfrags_doctor2[:10]:
    cfrag = reencrypt(capsule=capsule, kfrag=kfrag)
    cfrags_doc2.append(cfrag)    # Bob collects a cfrag


doc1_cleartext = decrypt_reencrypted(
    receiving_sk=doctor1_secret_key,
    delegating_pk=patient_public_key,
    capsule=capsule,
    verified_cfrags=cfrags_doc1,  # Changed from cfrags to verified_cfrags
    ciphertext=ciphertext
)
assert doc1_cleartext == plaintext
print(f"clear doc1 postre {doc1_cleartext}")

doc2_cleartext = decrypt_reencrypted(
    receiving_sk=doctor2_secret_key,
    delegating_pk=patient_public_key,
    capsule=capsule,
    verified_cfrags=cfrags_doc2,  # Changed from cfrags to verified_cfrags
    ciphertext=ciphertext
)
assert doc2_cleartext == plaintext
print(f"clear doc2 postre {doc2_cleartext}")


# Alice's Side:
# -------------
# [Plaintext]
#    |
# [Encryption with PKa]
#    |
# [Ciphertext] + [Capsule]
#    |
# [Generate KFrags]
#    |
# [Distribute KFrags to Proxies]

# Proxies' Side:
# --------------
# [Receive Capsule and KFrag]
#    |
# [Re-encrypt Capsule]
#    |
# [Produce CFrag]
#    |
# [Send CFrag to Bob]

# Bob's Side:
# -----------
# [Collect CFrags]
#    |
# [Assemble Capsule with CFrags]
#    |
# [Decrypt Ciphertext with SKb]
#    |
# [Plaintext]
