// models/employeeModel.js
const supabase = require('../config/supabase');

class EmployeeModel {

    async createEmployees(employees) {
        const { data, error } = await supabase
            .from('employees')
            .insert(employees)
            .select();
        return { data, error };
    }

    async getAllEmployees() {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });
        return { data, error };
    }

    async findByToken(token) {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('verification_token', token)
            .single();
        return { data, error };
    }

    async updateByToken(token, updates) {
        const { data, error } = await supabase
            .from('employees')
            .update(updates)
            .eq('verification_token', token)
            .select()
            .single();
        return { data, error };
    }
}

module.exports = new EmployeeModel();