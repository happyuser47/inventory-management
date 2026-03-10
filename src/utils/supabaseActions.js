import { supabase } from '../lib/supabase';

// --- INVENTORY ---
export const addStockToSupabase = async (item) => {
    const { error } = await supabase.from('inventory').insert([{
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        threshold: item.threshold,
        unit: item.unit,
        price: item.price
    }]);
    if (error) console.error(error);
};

export const updateStockToSupabase = async (item) => {
    const { error } = await supabase.from('inventory').update({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        threshold: item.threshold,
        unit: item.unit,
        price: item.price
    }).eq('id', item.id);
    if (error) console.error(error);
};

export const updateStockQuantityToSupabase = async (id, newQuantity) => {
    const { error } = await supabase.from('inventory').update({ quantity: newQuantity }).eq('id', id);
    if (error) console.error(error);
};

export const deleteStockFromSupabase = async (id) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) console.error(error);
};


// --- CATEGORIES ---
export const addCategoryToSupabase = async (name, icon) => {
    const { error } = await supabase.from('categories').insert([{ name, icon }]);
    if (error) console.error(error);
};

export const updateCategoryToSupabase = async (oldName, name, icon) => {
    // If name changed, we insert new, update relations conceptually, but let's just insert new and delete old safely, or just update primary key if supabase allows it easily? Actually altering PK is fine via supabase update
    const { error } = await supabase.from('categories').update({ name, icon }).eq('name', oldName);
    if (error) {
        // Fallback: create new, update dependencies, delete old
        await supabase.from('categories').insert([{ name, icon }]);
        await supabase.from('inventory').update({ category: name }).eq('category', oldName);
        await supabase.from('categories').delete().eq('name', oldName);
    }
};

export const deleteCategoryFromSupabase = async (name) => {
    const { error } = await supabase.from('categories').delete().eq('name', name);
    if (error) console.error(error);
};


// --- DISPENSING ---
export const processDispensingSupabase = async (recordId, items, totalAmount) => {
    const timestamp = new Date().toISOString();

    // 1. Create Record
    const { error: rError } = await supabase.from('dispense_history').insert([{
        record_id: recordId,
        timestamp,
        total_amount: totalAmount
    }]);
    if (rError) { console.error(rError); return; }

    // 2. Create Items
    const itemsData = items.map(item => ({
        record_id: recordId,
        item_id: item.id,
        item_name: item.name,
        dispense_qty: item.dispenseQty,
        price: item.price
    }));
    await supabase.from('dispense_history_items').insert(itemsData);

    // 3. Deduct Stock
    for (const item of items) {
        const { data } = await supabase.from('inventory').select('quantity').eq('id', item.id).single();
        if (data) {
            await updateStockQuantityToSupabase(item.id, data.quantity - item.dispenseQty);
        }
    }
};

export const deleteDispensingRecordSupabase = async (recordId, items) => {
    // 1. Restore Stock
    for (const item of items) {
        if (item.id) {
            const { data } = await supabase.from('inventory').select('quantity').eq('id', item.id).single();
            if (data) {
                await updateStockQuantityToSupabase(item.id, data.quantity + item.dispenseQty);
            }
        }
    }
    // 2. Delete Record (Cascade deletes items)
    await supabase.from('dispense_history').delete().eq('record_id', recordId);
};

export const deleteAllDispensingRecordsSupabase = async () => {
    // Note: This won't restore stock. Typically "Delete All History" is a cleanup action.
    // If we wanted to restore stock, we'd need to fetch all records first.
    // Given the request, we'll just wipe the tables.
    const { error: error1 } = await supabase.from('dispense_history_items').delete().neq('record_id', '0');
    const { error: error2 } = await supabase.from('dispense_history').delete().neq('record_id', '0');
    if (error1 || error2) console.error("Error deleting all records", error1, error2);
};


// --- PURCHASE ORDERS ---
export const createPOSupabase = async (poId, items) => {
    const date = new Date().toISOString();

    // 1. Create PO
    const { error: poError } = await supabase.from('purchase_orders').insert([{
        po_id: poId,
        status: 'Pending',
        date
    }]);
    if (poError) { console.error(poError); return; }

    // 2. Create PO Items
    const itemsData = items.map(item => ({
        po_id: poId,
        item_id: item.id,
        item_name: item.name,
        order_qty: item.orderQty,
        item_unit: item.unit,
        price: item.price
    }));
    await supabase.from('purchase_order_items').insert(itemsData);
};

export const receivePOSupabase = async (poId, itemsToReceive) => {
    const completionDate = new Date().toISOString();

    // 1. Update PO status
    await supabase.from('purchase_orders').update({
        status: 'Completed',
        completion_date: completionDate
    }).eq('po_id', poId);

    // 2. Process Items
    for (const reqItem of itemsToReceive) {
        // Update PO item received qty & optional new price
        await supabase.from('purchase_order_items').update({
            received_qty: reqItem.receivedQty,
            price: reqItem.price
        }).eq('po_id', poId).eq('item_id', reqItem.id);

        // Update Stock
        if (reqItem.receivedQty > 0) {
            const { data } = await supabase.from('inventory').select('quantity, price').eq('id', reqItem.id).single();
            if (data) {
                const newPrice = (reqItem.price && reqItem.price !== data.price) ? reqItem.price : data.price;
                await supabase.from('inventory').update({
                    quantity: data.quantity + reqItem.receivedQty,
                    price: newPrice
                }).eq('id', reqItem.id);
            }
        }
    }
};

// --- SETTINGS ---
export const saveSettingsToSupabase = async (settingsObj) => {
    const { error } = await supabase.from('settings').update({
        week_start_day: settingsObj.weekStartDay,
        month_start_date: settingsObj.monthStartDate,
        chart_type: settingsObj.chartType ?? 'bar',
    }).eq('id', 1);
    if (error) { // If it doesn't exist, insert
        await supabase.from('settings').insert([{
            id: 1,
            week_start_day: settingsObj.weekStartDay,
            month_start_date: settingsObj.monthStartDate,
            chart_type: settingsObj.chartType ?? 'bar',
        }]);
    }
};
