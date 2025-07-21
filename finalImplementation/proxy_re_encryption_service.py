from flask import Flask, request, jsonify
from umbral import (
    SecretKey,
    Signer,
    encrypt,
    decrypt_original,
    generate_kfrags,
    reencrypt,
    decrypt_reencrypted,
    Capsule,
)
import base64
import json
import pickle  # Only if using pickle serialization
import time

app = Flask(__name__)

# Simulated in-memory data storage
EMR_DATABASE = {}
PATIENT_KEYS = {}
DOCTOR_KEYS = {}
KFRAGS_DATABASE = {}


def serialize_capsule(capsule: Capsule) -> str:
    """
    Serializes a Capsule object to a Base64-encoded string.
    Choose one of the serialization methods below based on your Umbral version.
    """
    # Method 1: Using bytes() conversion (if supported)
    try:
        capsule_bytes = bytes(capsule)
        return base64.b64encode(capsule_bytes).decode("utf-8")
    except AttributeError:
        pass

    # Method 2: Using to_bytes()
    try:
        capsule_bytes = capsule.to_bytes()
        return base64.b64encode(capsule_bytes).decode("utf-8")
    except AttributeError:
        pass

    # Method 3: Using pickle serialization
    try:
        capsule_bytes = pickle.dumps(capsule)
        return base64.b64encode(capsule_bytes).decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to serialize Capsule: {str(e)}")


def deserialize_capsule(capsule_str: str) -> Capsule:
    """
    Deserializes a Base64-encoded string back to a Capsule object.
    Choose one of the deserialization methods below based on your Umbral version.
    """
    # Decode from Base64
    capsule_bytes = base64.b64decode(capsule_str.encode("utf-8"))

    # Method 1: Using Capsule.from_bytes()
    try:
        return Capsule.from_bytes(capsule_bytes)
    except AttributeError:
        pass

    # Method 2: Using bytes() conversion
    try:
        return Capsule.from_bytes(capsule_bytes)
    except AttributeError:
        pass

    # Method 3: Using pickle deserialization
    try:
        return pickle.loads(capsule_bytes)
    except Exception as e:
        raise ValueError(f"Failed to deserialize Capsule: {str(e)}")


def serialize_bytes(data: bytes) -> str:
    """
    Serializes bytes to a Base64-encoded string.
    """
    return base64.b64encode(data).decode("utf-8")


def deserialize_bytes(data_str: str) -> bytes:
    """
    Deserializes a Base64-encoded string back to bytes.
    """
    return base64.b64decode(data_str.encode("utf-8"))


@app.route("/encrypt_emr", methods=["POST"])
def encrypt_emr():
    """
    Encrypts EMR data for a patient.
    Expects JSON with 'patient_id' and 'plaintext'.
    """
    data = request.json
    patient_id = data.get("patient_id")
    plaintext = data.get("plaintext")

    if not patient_id or not plaintext:
        return jsonify({"error": "Missing patient_id or plaintext"}), 400

    # Ensure patient keys exist
    if patient_id not in PATIENT_KEYS:
        # Generate patient's Umbral keys
        patient_secret_key = SecretKey.random()
        patient_public_key = patient_secret_key.public_key()

        patient_signing_key = SecretKey.random()
        patient_signer = Signer(patient_signing_key)
        patient_verifying_key = patient_signing_key.public_key()

        PATIENT_KEYS[patient_id] = {
            "secret_key": patient_secret_key,
            "public_key": patient_public_key,
            "signing_key": patient_signing_key,
            "signer": patient_signer,
            "verifying_key": patient_verifying_key,
        }

    patient_keys = PATIENT_KEYS[patient_id]

    # Encrypt EMR data
    try:
        start_time = time.perf_counter()
        capsule, ciphertext = encrypt(
            patient_keys["public_key"], plaintext.encode("utf-8")
        )
        end_time = time.perf_counter()
        encryption_time = (end_time - start_time) * 1000  # in milliseconds
    except Exception as e:
        return jsonify({"error": f"Encryption failed: {str(e)}"}), 500

    # Serialize capsule and ciphertext for JSON
    try:
        serialized_capsule = serialize_capsule(capsule)
        serialized_ciphertext = serialize_bytes(ciphertext)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 500

    # Store encrypted EMR in database
    EMR_DATABASE[patient_id] = {
        "capsule": serialized_capsule,
        "ciphertext": serialized_ciphertext,
    }

    return (
        jsonify(
            {
                "message": "EMR encrypted successfully",
                "patient_id": patient_id,
                "EMR": EMR_DATABASE[patient_id],
                "encryption_time_ms": encryption_time,
            }
        ),
        200,
    )


@app.route("/generate_kfrags", methods=["POST"])
def generate_kfrags_endpoint():
    """
    Generates KFrags (Key Fragments) for authorized doctors.
    Expects JSON with 'patient_id' and 'doctor_ids'.
    """
    data = request.json
    patient_id = data.get("patient_id")
    doctor_ids = data.get("doctor_ids")

    if not patient_id or not doctor_ids:
        return jsonify({"error": "Missing patient_id or doctor_ids"}), 400

    if patient_id not in PATIENT_KEYS:
        return jsonify({"error": "Patient keys not found"}), 400

    patient_keys = PATIENT_KEYS[patient_id]

    kfrags_dict = {}
    timings = {}

    for doctor_id in doctor_ids:
        # Ensure doctor keys exist
        if doctor_id not in DOCTOR_KEYS:
            doctor_secret_key = SecretKey.random()
            doctor_public_key = doctor_secret_key.public_key()
            DOCTOR_KEYS[doctor_id] = {
                "secret_key": doctor_secret_key,
                "public_key": doctor_public_key,
            }
        doctor_keys = DOCTOR_KEYS[doctor_id]

        # Generate KFrags for the doctor
        try:
            start_time = time.perf_counter()
            kfrags = generate_kfrags(
                delegating_sk=patient_keys["secret_key"],
                receiving_pk=doctor_keys["public_key"],
                signer=patient_keys["signer"],
                threshold=10,
                shares=20,
            )
            end_time = time.perf_counter()
            generation_time = (end_time - start_time) * 1000  # in milliseconds
        except Exception as e:
            return (
                jsonify(
                    {
                        "error": f"Failed to generate KFrags for doctor {doctor_id}: {str(e)}"
                    }
                ),
                500,
            )

        # Store KFrags in database
        KFRAGS_DATABASE[(patient_id, doctor_id)] = kfrags

        kfrags_dict[doctor_id] = f"{len(kfrags)} KFrags generated"
        timings[doctor_id] = f"{generation_time:.2f} ms"

    return (
        jsonify(
            {
                "message": "KFrags generated successfully",
                "patient_id": patient_id,
                "kfrags_generated": kfrags_dict,
                "generation_times": timings,
            }
        ),
        200,
    )


@app.route("/decrypt_emr", methods=["POST"])
def decrypt_emr():
    """
    Allows an authorized doctor to decrypt a patient's EMR data.
    Expects JSON with 'doctor_id', 'patient_id', 'capsule', and 'ciphertext'.
    """
    data = request.json
    patient_id = data.get("patient_id")
    doctor_id = data.get("doctor_id")
    capsule_str = data.get("capsule")
    ciphertext_str = data.get("ciphertext")

    if not patient_id or not doctor_id or not capsule_str or not ciphertext_str:
        return (
            jsonify({"error": "Missing patient_id, doctor_id, capsule, or ciphertext"}),
            400,
        )

    if (patient_id not in PATIENT_KEYS) or (doctor_id not in DOCTOR_KEYS):
        return jsonify({"error": "Patient or Doctor keys not found"}), 400

    # Deserialize capsule and ciphertext
    try:
        capsule = deserialize_capsule(capsule_str)
        ciphertext = deserialize_bytes(ciphertext_str)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 500

    # Get KFrags
    kfrags_key = (patient_id, doctor_id)
    if kfrags_key not in KFRAGS_DATABASE:
        return jsonify({"error": "KFrags not found for this doctor"}), 400

    kfrags = KFRAGS_DATABASE[kfrags_key]

    patient_keys = PATIENT_KEYS[patient_id]
    doctor_keys = DOCTOR_KEYS[doctor_id]

    # Re-encryption using a subset of KFrags (threshold = 10)
    try:
        # Select the first 10 KFrags for decryption (assuming threshold = 10)
        cfrags = []
        start_reencrypt_time = time.perf_counter()
        for kfrag in kfrags[:10]:
            cfrag = reencrypt(capsule=capsule, kfrag=kfrag)
            cfrags.append(cfrag)
        end_reencrypt_time = time.perf_counter()
        reencryption_time = (end_reencrypt_time - start_reencrypt_time) * 1000  # in ms

        # Decrypt re-encrypted EMR
        start_decrypt_time = time.perf_counter()
        decrypted_plaintext = decrypt_reencrypted(
            receiving_sk=doctor_keys["secret_key"],
            delegating_pk=patient_keys["public_key"],
            capsule=capsule,
            verified_cfrags=cfrags,
            ciphertext=ciphertext,
        )
        end_decrypt_time = time.perf_counter()
        decryption_time = (end_decrypt_time - start_decrypt_time) * 1000  # in ms
    except Exception as e:
        return jsonify({"error": f"Decryption failed: {str(e)}"}), 500

    return (
        jsonify(
            {
                "message": "EMR decrypted successfully",
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "plaintext": decrypted_plaintext.decode("utf-8"),
                "reencryption_time_ms": reencryption_time,
                "decryption_time_ms": decryption_time,
            }
        ),
        200,
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
