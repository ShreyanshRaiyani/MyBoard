const asyncHandler = require("express-async-handler");
const User = require('../models/User.js');
const Device = require('../models/Device.js');
const { sendResetPasswordEmail } = require('../middelware/sendmail.js');
const bcrypt = require("bcryptjs");
const generateToken = require('../middelware/generatetoken.js');
const multer = require("multer");
const { deviceAddUpdate } = require('..//middelware/addupdatedevicedata.js');
const Country = require('../models/Country.js');
const State = require('../models/State.js');
const City = require('../models/City.js');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/userprofiles");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + file.originalname);
  },
});

// Create Super User

const createSuperUser = asyncHandler(async (req, res) => {
  console.log(req.body)
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(200).json({
      Status: 0,
      Message: "Please fill all the fields",
    });
  }

  let user = await User.findOne({ email });

  const SuperAdmin = await Role.findOne({ name: "SuperAdmin" });
  console.log("Admin id", SuperAdmin._id)
  if (user) {
    if (!user.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    user.role = [SuperAdmin._id];
    await user.save();

    return res.status(200).json({
      Status: 1,
      Message: "Super Admin role assigned to existing user",
      user: {
        email: user.email,
        roles: user.role,
      },
    });
  } else {
    return res.status(200).json({
      Status: 0,
      Message: "User not found",
    });
  }
});


const loginUser = asyncHandler(async (req, res) => {
  console.log("Login request body:", req.body);
  const { email, password, latitude, longitude, devicetoken, deviceId, devicetype } = req.body;
  // Check if email is provided
  if (!email) {
    return res.status(200).json({
      Status: 0,
      Message: "Please fill all the fields",
    });
  }
  console.log("Finding user with email:", email);
  // Find user
  const user = await User.findOne({ email }).select("+password").populate({ path: "role" });

  // If user not exists
  if (!user) {
    return res.status(200).json({
      Status: 0,
      Message: "Email is not Registered. Please register it first",
    });
  }
  const roleDocs = await Role.findById(user.role);
  const isAdmin = roleDocs.name === "SuperAdmin";
  if (!isAdmin) {
    return res.status(200).json({
      Status: 0,
      Message: "You are not authorized to sign in",
    });
  }
  let device;
  if (email && !password) {
    const otp = Math.floor(1000 + Math.random() * 9000);
    const verification = "confirm your email";
    await sendResetPasswordEmail(email, otp, verification, user, req);
    user.otp = otp;
    user.emailverified = false;
    await user.save();
  }

  if (email && password) {
    console.log("Verifying password for user:", email);
    console.log("Provided password:", password);
    console.log("Stored hashed password:", user.password);


    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(200).json({
        Status: 0,
        Message: "Password is not correct",
      });
    }
  }

  if (devicetoken && deviceId && devicetype) {
    console.log("Device info received. Updating device info...");
    const deviceData = {
      devicetoken,
      deviceId,
      devicetype,
      userid: user._id,
    };

    device = await deviceAddUpdate(deviceData);
    console.log("Device update result:", device);
    if (!device.Status) {
      console.log("Device update failed");
      return res.status(200).json({
        Status: 0,
        Message: "Something went wrong with device update",
      });
    }
  } else {
    console.log("Device info not fully provided, skipping device update");
  }
  const populatedUser = await User.findById(user._id)
    .select("-password -emailverified -otp")
    .populate({
      path: "role",
    })

  const defaultCountry = await Country.findOne({ default: true });
  const defaultState = await State.findOne({ default: true });
  const defaultCity = await City.findOne({ default: true });

  return res.status(200).json({
    Status: 1,
    Message: password ? "Login successful" : "OTP sent to your email for verification",
    user: populatedUser,
    defaultCountry,
    defaultState,
    defaultCity,
    device,
    UserToken: generateToken(user._id),
  });

});


// verifyOTP
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(200).json({
      Status: 0,
      Message: "Please fill all the fields",
    });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(200).json({
      Status: 0,
      Message: "User is not Registered",
    });
  }

  if (user.otp == otp) {
    return res.status(200).json({
      Status: 0,
      Message: "Wrong OTP",
    });
  }

  // OTP matched - update user
  user.emailverified = true;
  user.otp = null;
  await user.save();
  const populatedUser = await User.findById(user._id)
    .select("-password -emailverified -otp")
    .populate({
      path: "role",
      populate: {
        path: "responsibility",
        populate: { path: "actions" },
      },
    })
    .populate("country")
    .populate("state")
    .populate("city")
    .populate({
      path: "business",
      select: "-__v",
      populate: [
        { path: "country" },
        { path: "state" },
        { path: "city" },
        { path: "currency" },
      ],
    });



  // Fetch default locations
  const defaultCountry = await Country.findOne({ default: true });
  const defaultState = await State.findOne({ default: true });
  const defaultCity = await City.findOne({ default: true });

  return res.status(200).json({
    Status: 1,
    Message: "OTP verified Successfully",
    user: populatedUser,
    defaultCountry,
    defaultState,
    defaultCity,
    UserToken: generateToken(user._id),
  });
});

// logout user
const logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  console.log(user);
  if (user) {
    const device = await Device.findById(user.deviceid);
    if (device) {
      console.log(device);
      await Device.deleteOne(device._id);

      res.status(200).json({
        Status: 1,
        Message: "Logout successful",
      });
    } else {
      res.status(200).json({
        Status: 1,
        Message: "Logout successful",
      });
    }
  }

  res.status(200).json({
    Status: 0,
    Message: "Logout successful",
  });
});


// Return current user (requires protect middleware to run first)
const getUser = asyncHandler(async (req, res) => {



  const populatedUser = await User.findById(req.user.id)
    .select("-password -emailverified -otp")
    .populate({
      path: "role",
    })

  if (!populatedUser) {
    return res.status(200).json({ Status: 0, Message: 'User Not Found' });
  }
  return res.status(200).json({ Status: 1, Message: 'User fetched successfully', populatedUser });
});

// Update current user (requires protect middleware)
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(200).json({ Status: 0, Message: 'User Not Found' });
  }

  const { lastName, firstName, birthDate, mobileNumber, phone_code, iso_code, } = req.body;
  user.lastName = lastName || user.lastName;
  user.firstName = firstName || user.firstName;
  const [day, month, year] = birthDate.split("-");

  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  console.log("Parsed birthDate:", parsedDate);
  user.birthDate = parsedDate || user.birthDate;
  user.mobileNumber = mobileNumber || user.mobileNumber;
  user.phone_code = phone_code || user.phone_code;
  user.iso_code = iso_code || user.iso_code;
  if (req.uploadedFiles?.profilepic) {
    user.profilepic = req.uploadedFiles.profilepic;
  }
  await user.save();
  const populatedUser = await User.findById(user._id)
    .select("-password -emailverified -otp")
    .populate({
      path: "role",
    })

  return res.status(200).json({ Status: 1, Message: 'User updated successfully', user: populatedUser });
});


module.exports = {
  createSuperUser,
  loginUser,
  verifyOtp,
  logout,
  getUser,
  updateUser,
};
