const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const audit = require("mongoose-audit");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String, unique: true },
    password: { type: String, select: false },
    birthDate: { type: Date },
    mobileNumber: { type: String, unique: true, sparse: true, index: true },
    alternateMobileNumber: { type: String },
    whatsappNumber: { type: String },
    phone_code: { type: String },
    iso_code: { type: String },
    profilepic: { type: String, default: "generaluserpic.png" },
    emailverified: { type: Boolean, default: false },
    otp: { type: String, select: false },
    resettoken: { type: String },
    resettokentime: { type: String },
    memberId: { type: String, required: false },
    userType: {
      type: String,
      enum: ["SuperAdmin", "HoardingOwner", "BannerUser", "Worker"],
      required: true,
    },
    address: {
      country: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Country",
      },
      state: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "State",
      },
      city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
      },
      street: { type: String },
      pincode: { type: String },
    },
    // HoardingOwner specific fields
    hoardingLicense: {
      type: String,
    },
    business: {
      type: String,
    },
    businessPhoneNumber: {
      type: String,
    },
    accountStatus: { //only Admin can Change
      type: String,
      enum: ["Verified", "Pending", "Rejected"],
      default: "Pending",
    },
    gstNumber: {
      type: String,
    },
    gst_certificate: { type: String },
    aadharNumber: {
      type: String,
    },
    aadharFront: { type: String },
    aadharBack: { type: String },
    pan_number: { type: String },
    panimage: { type: String },

    // Worker specific fields
    workerType: {
      type: String,
      enum: ["Installation", "Maintenance", "Removal", "All"],
    },
    experience: { type: Number },
    skills: [{ type: String }],
    availability: {
      type: String,
      enum: ["Available", "Busy", "Unavailable"],
      default: "Available",
    },

    userStatus: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
    },

    // Added for rating system
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

function autoPopulate(next) {
  if (this.options && this.options.skipUserAutoPopulate) {
    return next();
  }
  this.populate({
    path: "address.city",
    select: "_id name"
  });

  this.populate({
    path: "address.state",
    select: "_id name"
  });

  this.populate({
    path: "address.country",
    select: "_id name"
  });
  this.populate({
    path: "plan",
    select: "_id name"
  });
  next();
}

userSchema.pre("find", autoPopulate);
userSchema.pre("findOne", autoPopulate);
userSchema.pre("findById", autoPopulate);

userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.otp;
    delete ret.resettoken;
    delete ret.resettokentime;
    delete ret.password;
    Object.keys(ret).forEach((key) => {
      if (ret[key] === null || ret[key] === undefined) {
        delete ret[key];
      }
    });
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);