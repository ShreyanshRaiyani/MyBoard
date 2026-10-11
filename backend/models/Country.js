const mongoose = require("mongoose");


const countrySchema = new mongoose.Schema({
    name: { type: String, required: false},
    default : {type: Boolean, default: false}
}, {
    timestamps: true,
});

countrySchema.pre(/^find/, async function(next) {
    const Model = mongoose.models['Country'];
    const count = await Model.countDocuments();
    if (count === 0) {
        await Model.insertMany([
           { name: "India", default: true},
        ]);
        console.log(' Default Country via pre-find hook.');
    }
    next();
});


module.exports = mongoose.models.Country || mongoose.model("Country", countrySchema);