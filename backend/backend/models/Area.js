const mongoose = require("mongoose");
require("./Country");
require("./State");
require("./City");

const areaSchema = new mongoose.Schema(
  {
    name: { type: String, required: false },
    city: { type: mongoose.Schema.Types.ObjectId, ref: "City" },
    country: { type: mongoose.Schema.Types.ObjectId, ref: "Country" },
    state: { type: mongoose.Schema.Types.ObjectId, ref: "State" },
    default: { type: Boolean, default: false },
  },
  { timestamps: true },
);

areaSchema.pre(/^find/, async function (next) {
  const Model = mongoose.models["Area"];
  const CityModel = mongoose.models["City"];
  const StateModel = mongoose.models["State"];
  const CountryModel = mongoose.models["Country"];
  const count = await Model.countDocuments();
  if (count === 0) {
    await CountryModel.findOne({ default: true }).then(async (country) => {
      await StateModel.findOne({ default: true }).then(async (state) => {
        await CityModel.findOne({ default: true }).then(async (city) => {
          await Model.insertMany([
            {
              name: "Nikol",
              country: country._id,
              state: state._id,
              city: city._id,
              default: true,
            },
          ]);
          console.log(" Default City via pre-find hook.");
        });
      });
    });
  }
  next();
});

function autoPopulate(next) {
  this.populate("country", "name");
  this.populate("state", "name");
  this.populate("city", "name");
  next();
}
areaSchema.pre("find", autoPopulate);
areaSchema.pre("findOne", autoPopulate);


module.exports = mongoose.models.Area || mongoose.model("Area", areaSchema);
