const mongoose = require("mongoose");
var Schema = mongoose.Schema;

const deviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    devicetype: { type: String, required: false },
    devicetoken: { type: String, required: false },
    userid: { type: Schema.Types.ObjectId, ref: 'users', required: true },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: false
        }
    }

}, { timestamps: true });

module.exports = mongoose.model("devices", deviceSchema);