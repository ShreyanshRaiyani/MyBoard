const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes.js');
const adminuserRoutes = require('./routes/adminUserRoutes.js');
const imageRoutes =  require('./routes/imageRoutes.js');
const unitRoutes = require('./routes/unitRoutes.js');
const areaRoutes = require('./routes/areaRoutes.js');
const cityRoutes = require('./routes/cityRoutes.js');
const stateRoutes = require('./routes/stateRoutes.js');
const countryRoutes = require('./routes/countryRoutes.js');
const bookingRoutes = require('./routes/bookingRoutes.js');
const hoardingRoutes = require('./routes/hoardingRoutes.js');
const notificationRoutes = require('./routes/notificationRoutes.js');
const notificationTrackingRoutes = require('./routes/notificationTrackingRoutes.js');
const queueRoutes = require('./routes/queueRoutes.js');
const workRequestRoutes = require('./routes/workRequestRoutes.js');
const planRoutes = require('./routes/planRoutes.js')
const purchasePlanRoutes = require('./routes/purchasePlanRoutes.js')

const app = express();

// If the app runs behind a reverse proxy (nginx, load balancer, AWS ALB/ELB)
// enable trust proxy so Express reads X-Forwarded-* headers (including protocol).
// This makes `req.protocol` reflect the original client protocol (https) when TLS
// is terminated by the proxy.
app.set('trust proxy', true);

app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));


app.use("/uploads", express.static("uploads"));

app.get('/', (req, res) => { res.send('Welcome To My Board'); res.end(); });
app.use('/api/user', userRoutes);
app.use('/api/admin', adminuserRoutes);
app.use('/api/unit', unitRoutes);
app.use('/api/area', areaRoutes);
app.use('/api/city', cityRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/country', countryRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/hoarding', hoardingRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/notification', notificationTrackingRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/workrequest', workRequestRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/purchaseplan', purchasePlanRoutes);

// app.use('/admin/api/dashboard', dashboardRoutes);

// Image upload & serving routes (stores DB record with domain-based URL, serves images from S3)
app.use('/', imageRoutes);

// Error handler — log full stack to help diagnose 500s (placed after all routes)
app.use((err, req, res, next) => {
	try {
		console.error('Unhandled error:', err && err.stack ? err.stack : err);
	} catch (e) {
		console.error('Error while logging error:', e);
	}
	res.status(500).json({ Status: 0, error: err && err.message ? err.message : 'Internal Server Error' });
});


module.exports = app;
