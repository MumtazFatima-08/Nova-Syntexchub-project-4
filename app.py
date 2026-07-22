from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from ai_engine import process_command

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)


@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/api/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return "", 204

    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()

    if not message:
        return jsonify({
            "reply": "I didn't receive any message.",
            "type": "unknown",
            "action": None,
            "url": None,
            "query": None,
        }), 400

    try:
        result = process_command(message)
        return jsonify(result), 200
    except Exception as exc:  # noqa: BLE001
        return jsonify({
            "reply": f"Something went wrong on the server: {exc}",
            "type": "error",
            "action": None,
            "url": None,
            "query": None,
        }), 500


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
