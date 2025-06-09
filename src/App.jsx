import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, doc, updateDoc, deleteDoc, query, setDoc } from 'firebase/firestore';
import { Upload, X, ShoppingCart, Plus, Minus, Trash2, Package, Users, DollarSign, Menu, ArrowLeft, Image as ImageIcon } from 'lucide-react';

// --- Firebase Configuration ---
// These variables are provided by the environment and should not be changed.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Main App Component ---
export default function App() {
    const [view, setView] = useState('store'); // 'store' or 'admin'
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const commonProps = {
        appId: appId,
        firebaseConfig: firebaseConfig
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <Package className="h-8 w-8 text-indigo-600" />
                            <h1 className="ml-2 text-2xl font-bold text-gray-800">Shopify Lite</h1>
                        </div>
                        <nav className="hidden md:flex items-center space-x-4">
                            <button
                                onClick={() => setView('store')}
                                className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'store' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                <Users className="inline-block w-4 h-4 mr-1" /> Customer View
                            </button>
                            <button
                                onClick={() => setView('admin')}
                                className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'admin' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                <Package className="inline-block w-4 h-4 mr-1" /> Admin Panel
                            </button>
                        </nav>
                        <div className="md:hidden">
                            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-600 hover:text-gray-800">
                                <Menu className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                </div>
                 {mobileMenuOpen && (
                    <div className="md:hidden bg-white border-t">
                        <nav className="flex flex-col p-4 space-y-2">
                            <button
                                onClick={() => { setView('store'); setMobileMenuOpen(false); }}
                                className={`block px-3 py-2 rounded-md text-base font-medium ${view === 'store' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                Customer View
                            </button>
                            <button
                                onClick={() => { setView('admin'); setMobileMenuOpen(false); }}
                                className={`block px-3 py-2 rounded-md text-base font-medium ${view === 'admin' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                Admin Panel
                            </button>
                        </nav>
                    </div>
                )}
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {view === 'admin' ? <AdminDashboard {...commonProps} /> : <Storefront {...commonProps} />}
            </main>
             <footer className="bg-white mt-12 py-6">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
                    <p>&copy; 2024 Shopify Lite. All rights reserved.</p>
                    <p className="text-xs mt-1">A simplified e-commerce platform built with React & Firebase.</p>
                </div>
            </footer>
        </div>
    );
}


// --- Firestore Hooks ---
const useFirestore = (firebaseConfig, appId) => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);

    useEffect(() => {
        if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
            try {
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firestoreAuth = getAuth(app);
                setDb(firestoreDb);
                setAuth(firestoreAuth);

                const authUnsubscribe = onAuthStateChanged(firestoreAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        try {
                            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                                await signInWithCustomToken(firestoreAuth, __initial_auth_token);
                            } else {
                                await signInAnonymously(firestoreAuth);
                            }
                        } catch (error) {
                            console.error("Firebase Auth Error:", error);
                        }
                    }
                });
                 return () => authUnsubscribe();

            } catch (error) {
                console.error("Firebase initialization failed:", error);
            }
        }
    }, [firebaseConfig]);

    const productsCollection = useMemo(() => db ? collection(db, `artifacts/${appId}/public/data/products`) : null, [db, appId]);
    const ordersCollection = useMemo(() => db ? collection(db, `artifacts/${appId}/public/data/orders`) : null, [db, appId]);
    
    return { db, auth, userId, productsCollection, ordersCollection };
};


// --- Admin Panel Components ---

const AdminDashboard = ({ firebaseConfig, appId }) => {
    const { productsCollection, ordersCollection } = useFirestore(firebaseConfig, appId);
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [editingProduct, setEditingProduct] = useState(null);
    const [showProductForm, setShowProductForm] = useState(false);
    
    useEffect(() => {
        if (!productsCollection) return;
        const unsubscribe = onSnapshot(query(productsCollection), (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(productsData.sort((a, b) => a.name.localeCompare(b.name)));
        });
        return () => unsubscribe();
    }, [productsCollection]);

    useEffect(() => {
        if (!ordersCollection) return;
        const unsubscribe = onSnapshot(query(ordersCollection), (snapshot) => {
            const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOrders(ordersData.sort((a,b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
        });
        return () => unsubscribe();
    }, [ordersCollection]);

    const handleEditProduct = (product) => {
        setEditingProduct(product);
        setShowProductForm(true);
    };

    const handleAddNewProduct = () => {
        setEditingProduct(null);
        setShowProductForm(true);
    };

    const handleFormClose = () => {
        setShowProductForm(false);
        setEditingProduct(null);
    };

    const handleDeleteProduct = async (id) => {
       if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                await deleteDoc(doc(productsCollection, id));
            } catch (error) {
                console.error("Error deleting product:", error);
                alert("Failed to delete product.");
            }
        }
    };
    
    const handleUpdateOrderStatus = async (orderId, newStatus) => {
        try {
            const orderRef = doc(ordersCollection, orderId);
            await updateDoc(orderRef, { status: newStatus });
        } catch(e) {
            console.error("Error updating order status: ", e);
            alert("Failed to update order status.");
        }
    };

    if (showProductForm) {
        return <ProductForm 
                    product={editingProduct} 
                    productsCollection={productsCollection}
                    onClose={handleFormClose} 
                />;
    }

    return (
        <div className="space-y-8">
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-gray-800">Product Management</h2>
                    <button onClick={handleAddNewProduct} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 transition-colors flex items-center">
                        <Plus className="w-5 h-5 mr-2"/> Add Product
                    </button>
                </div>
                <ProductList products={products} onEdit={handleEditProduct} onDelete={handleDeleteProduct} />
            </div>
            <div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Incoming Orders ({orders.filter(o => o.status === 'new').length} new)</h2>
                <OrderList orders={orders} onUpdateStatus={handleUpdateOrderStatus} />
            </div>
        </div>
    );
};

const ProductForm = ({ product, productsCollection, onClose }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [stock, setStock] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (product) {
            setName(product.name || '');
            setDescription(product.description || '');
            setPrice(product.price || '');
            setImageUrl(product.imageUrl || '');
            setStock(product.stock || '');
        }
    }, [product]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        const productData = {
            name,
            description,
            price: parseFloat(price),
            imageUrl,
            stock: parseInt(stock, 10),
        };

        try {
            if (product) {
                await updateDoc(doc(productsCollection, product.id), productData);
            } else {
                await addDoc(productsCollection, productData);
            }
            onClose();
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Failed to save product. Check console for details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">{product ? 'Edit Product' : 'Add New Product'}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6"/>
                </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Product Name</label>
                    <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows="4" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price ($)</label>
                        <input type="number" id="price" value={price} onChange={e => setPrice(e.target.value)} required min="0" step="0.01" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                    <div>
                        <label htmlFor="stock" className="block text-sm font-medium text-gray-700">Stock Quantity</label>
                        <input type="number" id="stock" value={stock} onChange={e => setStock(e.target.value)} required min="0" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                </div>
                <div>
                    <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700">Image URL</label>
                    <input type="url" id="imageUrl" value={imageUrl} onChange={e => setImageUrl(e.target.value)} required placeholder="https://example.com/image.png" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                </div>
                <div className="flex justify-end pt-2">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg mr-3 hover:bg-gray-300">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center">
                        {isSubmitting ? 'Saving...' : 'Save Product'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const ProductList = ({ products, onEdit, onDelete }) => (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {products.length === 0 ? (
                        <tr><td colSpan="4" className="text-center py-10 text-gray-500">No products found. Add one to get started!</td></tr>
                    ) : (
                        products.map(product => (
                            <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            <img className="h-10 w-10 rounded-full object-cover" src={product.imageUrl || 'https://placehold.co/40x40/e2e8f0/e2e8f0?text=P'} alt="" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${product.price.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.stock}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button onClick={() => onEdit(product)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                                    <button onClick={() => onDelete(product.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

const OrderList = ({ orders, onUpdateStatus }) => (
    <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Details</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {orders.length === 0 ? (
                        <tr><td colSpan="5" className="text-center py-10 text-gray-500">No orders yet.</td></tr>
                    ) : (
                        orders.map(order => (
                            <tr key={order.id} className={order.status === 'new' ? 'bg-indigo-50' : ''}>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-900">
                                        {order.items.map(item => <div key={item.id}>{item.name} (x{item.quantity})</div>)}
                                    </div>
                                    <div className="text-xs text-gray-500 pt-1">
                                        {order.createdAt?.toDate().toLocaleString()}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{order.customerName}</div>
                                    <div className="text-sm text-gray-500">{order.customerEmail}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${order.total.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        order.status === 'new' ? 'bg-green-100 text-green-800' :
                                        order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {order.status === 'new' && (
                                        <button onClick={() => onUpdateStatus(order.id, 'shipped')} className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600">Mark as Shipped</button>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
);


// --- Customer Storefront Components ---

const Storefront = ({ firebaseConfig, appId }) => {
    const { productsCollection, ordersCollection } = useFirestore(firebaseConfig, appId);
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState({});
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    
    useEffect(() => {
        if (!productsCollection) return;
        const unsubscribe = onSnapshot(query(productsCollection), (snapshot) => {
            const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(productsData.filter(p => p.stock > 0));
        });
        return () => unsubscribe();
    }, [productsCollection]);

    const addToCart = (productId) => {
        setCart(prevCart => {
            const newCart = { ...prevCart };
            newCart[productId] = (newCart[productId] || 0) + 1;
            return newCart;
        });
        setIsCartOpen(true);
    };

    const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

    const handleCheckoutSuccess = () => {
        setCart({});
        setIsCheckingOut(false);
        setIsCartOpen(false);
    };

    if (isCheckingOut) {
        return <CheckoutView 
                    cart={cart} 
                    products={products} 
                    ordersCollection={ordersCollection}
                    onBack={() => setIsCheckingOut(false)}
                    onSuccess={handleCheckoutSuccess} 
                />
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Our Products</h2>
                <button onClick={() => setIsCartOpen(true)} className="relative bg-white p-2 rounded-full shadow text-gray-600 hover:bg-gray-100">
                    <ShoppingCart className="h-6 w-6" />
                    {cartCount > 0 && <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">{cartCount}</span>}
                </button>
            </div>

            {products.length === 0 ? (
                 <div className="text-center py-20 bg-white rounded-lg shadow-md">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No Products Available</h3>
                    <p className="mt-1 text-sm text-gray-500">The store is currently empty. Please check back later!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {products.map(product => (
                        <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
                    ))}
                </div>
            )}
            
            <CartSidebar 
                isOpen={isCartOpen} 
                onClose={() => setIsCartOpen(false)} 
                cart={cart}
                setCart={setCart}
                products={products}
                onCheckout={() => setIsCheckingOut(true)}
            />
        </div>
    );
};

const ProductCard = ({ product, onAddToCart }) => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col group">
        <div className="relative">
            <img 
              className="h-56 w-full object-cover" 
              src={product.imageUrl} 
              alt={product.name} 
              onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/600x400/e2e8f0/a0aec0?text=Image+Not+Found'; }}
            />
            <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-40 transition-all duration-300"></div>
        </div>
        <div className="p-4 flex-grow flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800 truncate">{product.name}</h3>
            <p className="text-sm text-gray-600 mt-1 flex-grow">{product.description.substring(0, 60)}...</p>
            <div className="flex justify-between items-center mt-4">
                <p className="text-xl font-bold text-indigo-600">${product.price.toFixed(2)}</p>
                <button onClick={() => onAddToCart(product.id)} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-200 transition-colors text-sm">
                    Add to Cart
                </button>
            </div>
        </div>
    </div>
);

const CartSidebar = ({ isOpen, onClose, cart, setCart, products, onCheckout }) => {
    const cartItems = Object.entries(cart).map(([productId, quantity]) => {
        const product = products.find(p => p.id === productId);
        return { ...product, quantity };
    }).filter(item => item.id);

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const updateQuantity = (productId, newQuantity) => {
        setCart(prevCart => {
            const newCart = { ...prevCart };
            if (newQuantity > 0) {
                newCart[productId] = newQuantity;
            } else {
                delete newCart[productId];
            }
            return newCart;
        });
    };
    
    return (
        <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}>
            <div className={`fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl transform transition-transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
                <div className="flex flex-col h-full">
                    <header className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-lg font-semibold">Your Cart</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
                    </header>
                    <div className="flex-grow p-4 overflow-y-auto">
                        {cartItems.length === 0 ? (
                            <div className="text-center text-gray-500 mt-20">
                                 <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                                 <h3 className="mt-2 text-sm font-medium text-gray-900">Your cart is empty</h3>
                            </div>
                        ) : (
                            <ul className="space-y-4">
                                {cartItems.map(item => (
                                    <li key={item.id} className="flex items-center space-x-4">
                                        <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-md object-cover" />
                                        <div className="flex-grow">
                                            <p className="font-semibold text-sm">{item.name}</p>
                                            <p className="text-gray-600 text-sm">${item.price.toFixed(2)}</p>
                                            <div className="flex items-center mt-1">
                                                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="border rounded-l px-2 py-1 text-sm"><Minus className="w-3 h-3"/></button>
                                                <span className="border-t border-b px-3 py-1 text-sm">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="border rounded-r px-2 py-1 text-sm"><Plus className="w-3 h-3"/></button>
                                            </div>
                                        </div>
                                        <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                                        <button onClick={() => updateQuantity(item.id, 0)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {cartItems.length > 0 && (
                        <footer className="p-4 border-t">
                            <div className="flex justify-between items-center font-semibold mb-4">
                                <span>Subtotal</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                            <button onClick={onCheckout} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700">
                                Proceed to Checkout
                            </button>
                        </footer>
                    )}
                </div>
            </div>
        </div>
    );
};

const CheckoutView = ({ cart, products, ordersCollection, onBack, onSuccess }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const cartItems = Object.entries(cart).map(([productId, quantity]) => {
        const product = products.find(p => p.id === productId);
        return { ...product, quantity };
    }).filter(item => item.id);

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const orderData = {
            customerName: name,
            customerEmail: email,
            items: cartItems.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })),
            total: total,
            status: 'new',
            createdAt: new Date(),
        };

        try {
            await addDoc(ordersCollection, orderData);
            // In a real app, you would also update product stock here in a transaction
            alert("Order placed successfully! The merchant has been notified.");
            onSuccess();
        } catch (error) {
            console.error("Error placing order: ", error);
            alert("There was an error placing your order. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto">
            <button onClick={onBack} className="flex items-center text-indigo-600 font-semibold mb-4 hover:underline">
                <ArrowLeft className="w-4 h-4 mr-2"/> Back to Store
            </button>
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:border-r md:pr-8">
                    <h2 className="text-2xl font-bold mb-6">Your Information</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                        </div>
                         <div className="pt-4">
                            <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-400">
                                {isSubmitting ? "Placing Order..." : `Place Order ($${total.toFixed(2)})`}
                            </button>
                        </div>
                    </form>
                </div>
                <div>
                    <h2 className="text-2xl font-bold mb-6">Order Summary</h2>
                    <div className="space-y-4">
                         {cartItems.map(item => (
                            <div key={item.id} className="flex justify-between items-start">
                                <div className="flex items-start space-x-4">
                                     <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-md object-cover" />
                                     <div>
                                         <p className="font-semibold text-sm">{item.name}</p>
                                         <p className="text-gray-500 text-sm">Qty: {item.quantity}</p>
                                     </div>
                                </div>
                                <p className="font-semibold text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                         ))}
                    </div>
                    <div className="border-t mt-6 pt-4">
                         <div className="flex justify-between font-bold text-lg">
                             <span>Total</span>
                             <span>${total.toFixed(2)}</span>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
