const asyncHandler = require('express-async-handler');
const Device = require('../models/Device');

const deviceAddUpdate = asyncHandler(async (req, res) => {
    console.log(req);
    const { devicetoken, deviceId, type, userid, latitude, longitude } = req;

    // const device =await Device.find({deviceId:deviceId});
    const device = await Device.findOne({ deviceId: deviceId });
    console.log("Fdsfksjdflsdkjl");
    console.log(device);

    if (device) {
        console.log("Fdsfksjdflsdkjl");
        device.devicetoken = devicetoken;
        device.type = type;
        device.userid = userid;

        if (latitude && longitude) {
            device.location = {
                type: "Point",
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
            };
        }

        await device.save();
        //  device.save();

        return { Status: true, response: device };
    } else {
        const newdeviceData = {
            devicetoken: devicetoken,
            deviceId: deviceId,
            type: type,
            userid: userid,
        };

        // lat/long set karo agar aaye
        if (latitude && longitude) {
            newdeviceData.location = {
                type: "Point",
                coordinates: [parseFloat(longitude), parseFloat(latitude)]
            };
        }

        const newdevice = await Device.create(newdeviceData);

        if (newdevice) {
            return { Status: true, response: newdevice };
            // return res.status(200).json({ Status: true, response: newdevice });
        } else {
            return { Status: false, response: newdevice };
            // return res.status(400).json({ Status: false, response: newdevice });
        }
    }
});


module.exports = { deviceAddUpdate };