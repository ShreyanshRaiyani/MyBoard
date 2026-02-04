const mongoose = require("mongoose");

const hoardingSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hoardingName: {
      type: String,
      required: true,
    },
    hoardingCode: {
      type: String,
      unique: true,
      required: true,
    },
    description: {
      type: String,
    },
    location: {
      address: { type: String, required: true },
      city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
        required: true,
      },
      state: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "State",
        required: true,
      },
      country: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Country",
        required: true,
      },
      pincode: { type: String },
      coordinates: {
        latitude: { type: Number },
        longitude: { type: Number },
      },
    },
    dimensions: {
      width: { type: Number, required: true },
      height: { type: Number, required: true }, 
      area: { type: Number }, 
      unit:{type:mongoose.Schema.Types.ObjectId, ref: 'Unit'}
    },
    type: {
      type: String,
      enum: ["Billboard", "Pole", "Digital", "Wall", "Transit", "Other"],
      required: true,
    },
    images: [
      {
        url: { type: String },
        caption: { type: String },
      },
    ],
    pricePerDay: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["Active", "Booked", "Inactive"],
      default: "Active",
    },
    facingDirection: {
      type: String,
      enum: ["North", "South", "East", "West", "NorthEast", "NorthWest", "SouthEast", "SouthWest"],
    },
    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalBookings: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Calculate area before saving
hoardingSchema.pre("save", function (next) {
  if (this.dimensions.width && this.dimensions.height) {
    this.dimensions.area = this.dimensions.width * this.dimensions.height;
  }
  next();
});

function autoPopulate(next) {
  this.populate("owner", "firstName lastName email mobileNumber");
  this.populate("location.city");
  this.populate("location.state");
  this.populate("location.country");
  next();
}

hoardingSchema.pre("find", autoPopulate);
hoardingSchema.pre("findOne", autoPopulate);
hoardingSchema.pre("findById", autoPopulate);

module.exports = mongoose.model("Hoarding", hoardingSchema);