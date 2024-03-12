const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FilteredContactSchema = new Schema({
  od: Number,
  contact_name: String,
  contact_first_name: String,
  contact_middle_name: String,
  contact_last_name: String,
  contact_job_title_1: String,
  contact_job_title_level_1: String,
  contact_job_dept_name_1: String,
  contact_job_function_name_1: String,
  contact_email_1: String,
  contact_phone_1: String,
  company_company_name: String,
  company_website: String,
  company_address_street: String,
  company_address_city: String,
  company_address_state: String,
  company_address_country: String,
  company_address_zipcode: String,
  company_employee_size: String,
  company_annual_revenue_amount: String,
  company_industry_categories_list: String,
  company_tech_keywords_list: String,
  sic_code: String,
  npi_number: String,
  contact_social_linkedin: String,
  visited_validators: {
    type: Array,
    default: [],
  },
  passed_validator: String,
});

module.exports = FilteredContact = mongoose.model(
  "canada_software_filtered_by_john",
  FilteredContactSchema
);
