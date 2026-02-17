const mongoose = require("mongoose");
require('./Country');
require('./State');


const citySchema = new mongoose.Schema({
    name: { type: String, required: false },
    country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    state: { type: mongoose.Schema.Types.ObjectId, ref: 'State' },
    default : {type: Boolean, default: false}
}, { timestamps: true });


citySchema.pre(/^find/, async function(next) {
    
    const Model = mongoose.models['City'];
    const StateModel = mongoose.models['State'];
    const CountryModel = mongoose.models['Country'];
    const count = await Model.countDocuments();
    if (count === 0) {
      await CountryModel.findOne({ default: true }).then(async (country) => {
        await StateModel.findOne({ default: true }).then(async (state) => {
          await Model.insertMany([
            { name: "Ahmedabad", country: country._id, state: state._id ,default: true},
          ]);
          console.log(' Default City via pre-find hook.');
        });
      });
}
    next();
});


module.exports = mongoose.models.City || mongoose.model("City", citySchema);