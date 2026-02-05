const Unit = require('../models/unit');
const asyncHandler = require('express-async-handler');



const createUnit = asyncHandler(async (req, res) => {
    const { unitName } = req.body;

    // Check if unit already exists
    const unitExists = await Unit.findOne({ unitName });
    if (unitExists) {
        res.status(400);
        throw new Error('Unit with this name already exists');
    }

    const unit = await Unit.create({ unitName });

    res.status(201).json({
        success: true,
        message: 'Unit created successfully',
        data: unit
    });
});

const getUnits = asyncHandler(async (req, res) => {
    const units = await Unit.find().sort({ createdAt: -1 });
    res.status(200).json({
        success: true,
        count: units.length,
        data: units
    });
});


const getUnit = asyncHandler(async (req, res) => {
    const unit = await Unit.findById(req.params.id);

    if (!unit) {
        res.status(404);
        throw new Error('Unit not found');
    }

    res.status(200).json({
        success: true,
        data: unit
    });
});


const updateUnit = asyncHandler(async (req, res) => {
    let unit = await Unit.findById(req.params.id);

    if (!unit) {
        res.status(404);
        throw new Error('Unit not found');
    }

    // Check if new unitName already exists (excluding current unit)
    if (req.body.unitName && req.body.unitName !== unit.unitName) {
        const unitExists = await Unit.findOne({
            unitName: req.body.unitName,
            _id: { $ne: req.params.id }
        });
        if (unitExists) {
            res.status(400);
            throw new Error('Unit with this name already exists');
        }
    }

    unit = await Unit.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    res.status(200).json({
        success: true,
        message: 'Unit updated successfully',
        data: unit
    });
});


const deleteUnit = asyncHandler(async (req, res) => {
    const unit = await Unit.findById(req.params.id);

    if (!unit) {
        res.status(404);
        throw new Error('Unit not found');
    }

    await Unit.deleteOne({ _id: req.params.id });

    res.status(200).json({
        success: true,
        message: 'Unit deleted successfully',
        data: {}
    });
});


module.exports = {
    createUnit,
    getUnits,
    getUnit,
    updateUnit,
    deleteUnit,
};