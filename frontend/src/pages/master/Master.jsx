import React from 'react';
import { Link } from 'react-router-dom';

const Box = ({ to, title, description }) => (
  <Link to={to} className="master-box">
    <div className="box-title">{title}</div>
    <div className="box-desc">{description}</div>
  </Link>
);

const Master = () => {
  return (
    <div className="master-page">
      <h2>Master</h2>
      <p>Select a master list to manage</p>

      <div className="master-grid">
        <Box to="/master/country" title="Country" description="Manage countries" />
        <Box to="/master/state" title="State" description="Manage states" />
        <Box to="/master/city" title="City" description="Manage cities" />
        <Box to="/master/area" title="Area" description="Manage areas" />
      </div>
    </div>
  );
};

export default Master;
