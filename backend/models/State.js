const mongoose = require("mongoose");
require('./Country');


const stateSchema = new mongoose.Schema({
    name: { type: String, required: false},
    country: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Country',
    },
    default : {type: Boolean, default: false}
    
}, {
    timestamps: true,
});

stateSchema.statics.seedDefaults = async function (countryIdMap) {
  const count = await this.countDocuments();
  if (count === 0) {
    const statesToInsert = defaultState.map(state => ({
      name: state.name,
      country: countryIdMap[state.country_id],
    }));
    const inserted = await this.insertMany(statesToInsert);
    const idMap = {};
    inserted.forEach((doc, i) => { idMap[defaultState[i].id] = doc._id; });
    return idMap;
  } else {
    const all = await this.find();
    const idMap = {};
    all.forEach(doc => {
      const sample = defaultState.find(s => s.name === doc.name);
      if (sample) idMap[sample.id] = doc._id;
    });
    return idMap;
  }
};


stateSchema.pre(/^find/, async function(next) {
    const Model = mongoose.models['State'];
    const CountryModel = mongoose.models['Country'];
    const count = await Model.countDocuments();
    if (count === 0) {
      await CountryModel.findOne({ default: true }).then(async (country) => {
        await Model.insertMany([
           { name: "Gujarat", country: country._id, default: true}, 
        ]);
        console.log('Default State via pre-find hook.');
    });
  }
    next();
});


module.exports = mongoose.models.State || mongoose.model("State", stateSchema);