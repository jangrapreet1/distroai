import Dexie, { type EntityTable } from 'dexie';

export interface ProductOffline {
    id: string;
    sku: string;
    name: string;
    brand?: string | null;
    mrp: number;
    sellingPrice: number;
    stockInfo: string;
}

const db = new Dexie('DistroAIOfflineDB') as Dexie & {
    products: EntityTable<
        ProductOffline,
        'id'
    >;
};

// Define primary key and indexes
// id is primary key, sku and name are indexed for fast searching
db.version(1).stores({
    products: 'id, sku, name'
});

export { db };
