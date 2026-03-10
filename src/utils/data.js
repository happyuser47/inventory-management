import {
    ShieldPlus, Pill, Sparkles, Shield, Droplet, Wind, HeartPulse, Scissors, Stethoscope, Syringe, Archive, Activity, Package, FlaskConical, Thermometer
} from 'lucide-react';

export const initialInventory = [
    { id: '#MED101', name: 'Amoxicillin 500mg', category: 'Antibiotics', quantity: 1200, price: 50.00, unit: 'Capsules', threshold: 200 },
    { id: '#MED102', name: 'Panadol (Paracetamol)', category: 'Pain Relievers', quantity: 45, price: 5.00, unit: 'Tablets', threshold: 100 },
    { id: '#MED103', name: 'Vitamin C 1000mg', category: 'Vitamins & Supplements', quantity: 500, price: 15.00, unit: 'Tablets', threshold: 100 },
    { id: '#MED104', name: 'Acyclovir 400mg', category: 'Antiviral Drugs', quantity: 0, price: 120.00, unit: 'Tablets', threshold: 50 },
    { id: '#MED105', name: 'Insulin Glargine', category: 'Diabetes Care', quantity: 30, price: 1500.00, unit: 'Vials', threshold: 20 },
    { id: '#MED106', name: 'Salbutamol Inhaler', category: 'Respiratory', quantity: 60, price: 450.00, unit: 'Inhalers', threshold: 15 },
    { id: '#MED107', name: 'Loratadine 10mg', category: 'Allergy Medication', quantity: 350, price: 10.00, unit: 'Tablets', threshold: 100 },
    { id: '#MED108', name: 'Amlodipine 5mg', category: 'Cardiovascular', quantity: 80, price: 15.00, unit: 'Tablets', threshold: 100 },
];

export const AVAILABLE_ICONS = {
    ShieldPlus, Pill, Sparkles, Shield, Droplet, Wind, HeartPulse, Scissors, Stethoscope, Syringe, Archive, Activity, Package, FlaskConical, Thermometer
};

export const initialCategoryMap = {
    'Antibiotics': 'ShieldPlus',
    'Pain Relievers': 'Pill',
    'Vitamins & Supplements': 'Sparkles',
    'Antiviral Drugs': 'Shield',
    'Diabetes Care': 'Droplet',
    'Respiratory': 'Wind',
    'Allergy Medication': 'Pill',
    'Cardiovascular': 'HeartPulse',
    'Surgical Items': 'Scissors',
    'Equipments': 'Stethoscope',
    'Vaccines': 'Syringe',
    'Others': 'Archive'
};
