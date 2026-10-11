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
      address: { type: String },
      area:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Area",
        
      },
      city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
        
      },
      state: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "State",
  
      },
      country: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Country",

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
      unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' }
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
    status: { // booking perpose
      type: String,
      enum: ["Active", "Booked", "Inactive"],
      default: "Active",
    },
    approvalStatus: { //approval perpose
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    isActive: { // hoarding Active or Inactive
      type: Boolean,
      default: true,
    },
    averageFeedback: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalBookings: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: String,
      default: null,
      ref: 'User'
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
  this.populate("location.area", "name"); 
  this.populate("location.city", "name"); 
  this.populate("location.state", "name"); 
  this.populate("location.country", "name"); 
  this.populate("dimensions.unit", "unitName"); 
  next();
}

hoardingSchema.pre("find", autoPopulate);
hoardingSchema.pre("findOne", autoPopulate);
hoardingSchema.pre("findById", autoPopulate);

module.exports = mongoose.model("Hoarding", hoardingSchema);