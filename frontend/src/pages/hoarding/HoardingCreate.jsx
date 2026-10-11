import React, { useState, useEffect } from 'react';
import MainLayout from '../../layout/MainLayout';
import CommonModel from '../../components/CommonModel';

const HoardingCreate = () => {
	const [form, setForm] = useState({
		hoardingName: '',
		hoardingCode: '',
		description: '',
		location: {
			address: '',
			area: '',
			city: '',
			state: '',
			country: '',
			pincode: '',
			coordinates: { latitude: '', longitude: '' },
		},
		dimensions: { width: '', height: '', area: '', unit: '' },
		type: 'Billboard',
		pricePerDay: '',
		status: 'Active',
		approvalStatus: 'Pending',
		images: [],
	});

	const [showImagesModal, setShowImagesModal] = useState(false);

	// mock selects
	const [countries] = useState([{ id: '1', name: 'India' }]);
	const [states] = useState([{ id: '1', name: 'Gujarat' }]);
	const [cities] = useState([{ id: '1', name: 'Ahmedabad' }]);
	const [areas] = useState([{ id: '1', name: 'Satellite' }]);
	const [units] = useState([{ id: '1', name: 'sqm' }]);

	function onChange(path, value) {
		// simple nested set
		setForm(prev => {
			const copy = JSON.parse(JSON.stringify(prev));
			const parts = path.split('.');
			let cur = copy;
			for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
			cur[parts[parts.length - 1]] = value;
			return copy;
		});
	}

	function addImage(file) {
		// placeholder: store name/url locally
		setForm(f => ({ ...f, images: [...f.images, { url: URL.createObjectURL(file), caption: '' }] }));
	}

	function submit(e) {
		e.preventDefault();
		// TODO: send to API
		console.log('submit', form);
		alert('Hoarding saved (mock)');
	}

	return (
		<MainLayout>
			<div className="page-content">
				<h2>Create Hoarding</h2>

				<form className="hoarding-form" onSubmit={submit}>
					<div className="grid">
						<label>
							Name
							<input value={form.hoardingName} onChange={(e)=>onChange('hoardingName', e.target.value)} required />
						</label>

						<label>
							Code
							<input value={form.hoardingCode} onChange={(e)=>onChange('hoardingCode', e.target.value)} required />
						</label>

						<label style={{ gridColumn: '1 / -1' }}>
							Description
							<textarea value={form.description} onChange={(e)=>onChange('description', e.target.value)} />
						</label>

						<fieldset>
							<legend>Location</legend>
							<label>
								Address
								<input value={form.location.address} onChange={(e)=>onChange('location.address', e.target.value)} />
							</label>
							<label>
								Country
								<select value={form.location.country} onChange={(e)=>onChange('location.country', e.target.value)}>
									<option value="">Select</option>
									{countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
								</select>
							</label>
							<label>
								State
								<select value={form.location.state} onChange={(e)=>onChange('location.state', e.target.value)}>
									<option value="">Select</option>
									{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
								</select>
							</label>
							<label>
								City
								<select value={form.location.city} onChange={(e)=>onChange('location.city', e.target.value)}>
									<option value="">Select</option>
									{cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
								</select>
							</label>
							<label>
								Area
								<select value={form.location.area} onChange={(e)=>onChange('location.area', e.target.value)}>
									<option value="">Select</option>
									{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
								</select>
							</label>

							<label>
								Pincode
								<input value={form.location.pincode} onChange={(e)=>onChange('location.pincode', e.target.value)} />
							</label>

							<label>
								Latitude
								<input value={form.location.coordinates.latitude} onChange={(e)=>onChange('location.coordinates.latitude', e.target.value)} />
							</label>
							<label>
								Longitude
								<input value={form.location.coordinates.longitude} onChange={(e)=>onChange('location.coordinates.longitude', e.target.value)} />
							</label>
						</fieldset>

						<fieldset>
							<legend>Dimensions</legend>
							<label>
								Width
								<input type="number" value={form.dimensions.width} onChange={(e)=>onChange('dimensions.width', e.target.value)} required />
							</label>
							<label>
								Height
								<input type="number" value={form.dimensions.height} onChange={(e)=>onChange('dimensions.height', e.target.value)} required />
							</label>
							<label>
								Area
								<input type="number" value={form.dimensions.area} onChange={(e)=>onChange('dimensions.area', e.target.value)} />
							</label>
							<label>
								Unit
								<select value={form.dimensions.unit} onChange={(e)=>onChange('dimensions.unit', e.target.value)}>
									<option value="">Select</option>
									{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
								</select>
							</label>
						</fieldset>

						<label>
							Type
							<select value={form.type} onChange={(e)=>onChange('type', e.target.value)}>
								{['Billboard','Pole','Digital','Wall','Transit','Other'].map(t=> <option key={t} value={t}>{t}</option>)}
							</select>
						</label>

						<label>
							Price Per Day
							<input type="number" value={form.pricePerDay} onChange={(e)=>onChange('pricePerDay', e.target.value)} />
						</label>

						<label>
							Status
							<select value={form.status} onChange={(e)=>onChange('status', e.target.value)}>
								{['Active','Booked','Inactive'].map(s=> <option key={s} value={s}>{s}</option>)}
							</select>
						</label>

						<label>
							Approval Status
							<select value={form.approvalStatus} onChange={(e)=>onChange('approvalStatus', e.target.value)}>
								{['Pending','Approved','Rejected'].map(s=> <option key={s} value={s}>{s}</option>)}
							</select>
						</label>

						<div style={{ gridColumn: '1 / -1' }}>
							<label>Images</label>
							<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								<input type="file" accept="image/*" onChange={(e)=> e.target.files[0] && addImage(e.target.files[0])} />
								<button type="button" onClick={()=>setShowImagesModal(true)}>Manage Images</button>
							</div>
							<div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
								{form.images.map((img, idx)=> (
									<div key={idx} style={{ width:120, height:80, borderRadius:8, overflow:'hidden', background:'#f2f2f2' }}>
										<img src={img.url} alt="img" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
									</div>
								))}
							</div>
						</div>

					</div>

					<div style={{ marginTop: 16 }}>
						<button type="submit" className="btn primary">Save</button>
						<button type="button" onClick={()=>console.log('cancel')} className="btn secondary" style={{ marginLeft: 8 }}>Cancel</button>
					</div>
				</form>

				<CommonModel open={showImagesModal} title="Manage Images" onClose={()=>setShowImagesModal(false)} primaryLabel="Done" onPrimary={()=>setShowImagesModal(false)}>
					<p>Image management UI placeholder. Implement captions, reorder, delete here.</p>
				</CommonModel>
			</div>
		</MainLayout>
	);
};

export default HoardingCreate;

