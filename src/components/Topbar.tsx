import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserCircleIcon,
  Settings01Icon,

  Notification01Icon,
  CancelCircleIcon,
  Alert01Icon,
  CheckmarkCircle01Icon,
  Menu01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { getLowStockProducts, getNearExpiryBatches, searchProducts } from "../renderer/services/productApi";
import { getSettings } from "../renderer/services/settingsApi";

const NAV_LINKS = [
  { label: "Dashboard", path: "/admin/dashboard", keywords: ["dashboard"] },
  { label: "Reports", path: "/admin/reports", keywords: ["reports"] },
  { label: "GST Report", path: "/admin/gst-report", keywords: ["gst", "report", "tax"] },
  { label: "Supplier", path: "/admin/supplier", keywords: ["supplier", "vendor"] },
  { label: "Purchase History", path: "/admin/purchases", keywords: ["purchase", "history", "purchases"] },
  { label: "Staff", path: "/admin/staff", keywords: ["staff", "employee"] },
  { label: "Schedule Register", path: "/admin/h1-register", keywords: ["schedule", "register", "h1", "h"] },
  { label: "Audit Logs", path: "/admin/audit-logs", keywords: ["audit", "log", "logs"] },
  { label: "Products", path: "/admin/products", keywords: ["products", "item"] },
  { label: "Purchase", path: "/admin/purchase", keywords: ["purchase", "buy"] },
  { label: "Stock", path: "/admin/stock", keywords: ["stock", "inventory"] },
  { label: "Sales", path: "/admin/sales", keywords: ["sales", "sell"] },
  { label: "Customer", path: "/admin/customer", keywords: ["customer", "client"] },
  { label: "Settings", path: "/admin/settings", keywords: ["settings", "config"] },
];

interface TopBarProps {
    onMenuClick?: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [lowStockItems, setLowStockItems] = useState<any[]>([]);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
    const [batchCount, setBatchCount] = useState(0);
    const [activeNotifTab, setActiveNotifTab] = useState<"medicine" | "batches">("medicine");
    const [shopName, setShopName] = useState("");

    useEffect(() => {
        getSettings().then(res => {
            const s = res?.data || res;
            if (s?.shop_name) setShopName(s.shop_name);
        }).catch(() => { });
    }, []);

    const loadNotifications = () => {
        getLowStockProducts().then((data: any[]) => {
            const items = Array.isArray(data) ? data : [];
            setLowStockItems(items);
            setLowStockCount(items.length);
        }).catch(() => {
            setLowStockItems([]);
            setLowStockCount(0);
        });
        getNearExpiryBatches().then((data: any[]) => {
            const items = Array.isArray(data) ? data : [];
            setExpiringBatches(items);
            setBatchCount(items.length);
        }).catch(() => {
            setExpiringBatches([]);
            setBatchCount(0);
        });
    };

    useEffect(() => {
        loadNotifications();
        const interval = setInterval(loadNotifications, 30000);
        window.addEventListener('stock-updated', loadNotifications);
        window.addEventListener('batches-updated', loadNotifications);
        return () => {
            clearInterval(interval);
            window.removeEventListener('stock-updated', loadNotifications);
            window.removeEventListener('batches-updated', loadNotifications);
        };
    }, []);

    const getRoleTranslation = (role?: string) => {
        switch (role) {
            case 'owner': return t('topbar.roles.owner');
            case 'manager': return t('topbar.roles.manager');
            case 'cashier': return t('topbar.roles.cashier');
            default: return t('topbar.roles.user');
        }
    };

    const handleClearNotifs = () => {
        setLowStockItems([]);
        setLowStockCount(0);
    };

    const handleNavigate = (path: string) => {
        navigate(path);
    };

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [matchedPages, setMatchedPages] = useState<typeof NAV_LINKS>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setMatchedPages([]);
            setShowSearchDropdown(false);
            return;
        }
        const q = searchQuery.trim().toLowerCase();
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            const [products] = await Promise.all([searchProducts(searchQuery.trim())]);
            setSearchResults(products);
            setMatchedPages(
                NAV_LINKS.filter(
                    (link) =>
                        link.label.toLowerCase().includes(q) ||
                        link.keywords.some((k) => k.includes(q))
                )
            );
            setShowSearchDropdown(products.length > 0 || NAV_LINKS.some(
                (link) =>
                    link.label.toLowerCase().includes(q) ||
                    link.keywords.some((k) => k.includes(q))
            ));
            setSearchLoading(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div className="flex items-center justify-between pl-4 pr-2 py-1 bg-white rounded-full w-[98%] mx-auto my-[1%]">
            <div className="flex items-center gap-4">
                {shopName && (
                    <div className="flex flex-col items-start pl-3">
                        <span className="text-gray-500 font-semibold text-xs leading-none">Hello,</span>
                        <span className="text-gray-900 font-bold text-lg tracking-tight whitespace-nowrap">{shopName}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">

                {/* Mobile Menu Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onMenuClick}
                    className="md:hidden text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                >
                    <HugeiconsIcon icon={Menu01Icon} className="text-xl"  />
                </Button>

                {/* Global Search */}
                <div ref={searchRef} className="relative hidden sm:block">
                    <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg"  />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true); }}
                        placeholder={t('common.search') || "Search products..."}
                        className="pl-10 pr-4 py-2.5 bg-transparent border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent w-56 lg:w-72"
                    />
                    {showSearchDropdown && (
                        <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto thin-scrollbar">
                            {searchLoading && (
                                <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                            )}
                            {!searchLoading && matchedPages.length === 0 && searchResults.length === 0 && (
                                <div className="px-4 py-6 text-sm text-gray-400 text-center">No results found</div>
                            )}
                            {!searchLoading && matchedPages.length > 0 && (
                                <>
                                    <div className="sticky top-0 bg-white px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                        Pages ({matchedPages.length})
                                    </div>
                                    {matchedPages.map((link) => (
                                        <button
                                            key={link.path}
                                            onClick={() => {
                                                setShowSearchDropdown(false);
                                                setSearchQuery("");
                                                navigate(link.path);
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                        >
                                            <span className="text-sm font-medium text-gray-700">{link.label}</span>
                                        </button>
                                    ))}
                                </>
                            )}
                            {!searchLoading && searchResults.length > 0 && (
                                <>
                                    {matchedPages.length > 0 && <div className="border-t border-gray-100" />}
                                    <div className="sticky top-0 bg-white px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                        Products ({searchResults.length})
                                    </div>
                                    {searchResults.map((product: any) => (
                                        <button
                                            key={product.product_uuid}
                                            onClick={() => {
                                                setShowSearchDropdown(false);
                                                setSearchQuery("");
                                                navigate('/admin/products');
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                                        >
                                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                {product.sku && <span className="text-xs text-gray-400">{product.sku}</span>}
                                                {product.manufacturer && <span className="text-xs text-gray-400">{product.manufacturer}</span>}
                                                <span className="text-xs font-medium text-green-600 ml-auto">{product.stock ?? 0} in stock</span>
                                            </div>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Notifications Bell */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 rounded-full h-12 w-12 flex items-center justify-center focus-visible:ring-0 focus-visible:ring-offset-0">
                            <HugeiconsIcon icon={Notification01Icon} className="text-xl"  />
                            {(lowStockCount + batchCount) > 0 && (
                                <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full">
                                    {lowStockCount + batchCount > 99 ? '99+' : lowStockCount + batchCount}
                                </Badge>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 bg-white text-black border border-gray-200 shadow-2xl p-2">
                        <DropdownMenuLabel className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
                            <span className="text-sm font-semibold text-gray-900">{t('topbar.notifTitle')}</span>
                        </DropdownMenuLabel>
                        {/* Tabs */}
                        <div className="flex border-b border-gray-200">
                            <button
                                onClick={() => setActiveNotifTab("medicine")}
                                className={`flex-1 px-3 py-2 text-xs font-medium text-center transition-colors ${activeNotifTab === "medicine"
                                    ? "text-green-600 border-b-2 border-green-500"
                                    : "text-gray-400 hover:text-gray-600"}`}
                            >
                                Medicine
                                {lowStockCount > 0 && (
                                    <span className="ml-1.5 px-1.5 py-0.5 bg-red-500/10 text-red-600 text-[10px] rounded-full">{lowStockCount}</span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveNotifTab("batches")}
                                className={`flex-1 px-3 py-2 text-xs font-medium text-center transition-colors ${activeNotifTab === "batches"
                                    ? "text-green-600 border-b-2 border-green-500"
                                    : "text-gray-400 hover:text-gray-600"}`}
                            >
                                Batches
                                {batchCount > 0 && (
                                    <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] rounded-full">{batchCount}</span>
                                )}
                            </button>
                        </div>
                        <ScrollArea className="h-[320px]">
                            {activeNotifTab === "medicine" && (
                                lowStockItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                        <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-3xl text-green-500"  />
                                        </div>
                                        <p className="text-sm font-medium text-gray-700">{t('topbar.notifAllGood')}</p>
                                        <p className="text-xs text-gray-500 mt-1">{t('topbar.notifAllGoodSub')}</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-200">
                                        {lowStockItems.map((item: any) => (
                                            <DropdownMenuItem
                                                key={item.product_uuid}
                                                onClick={() => navigate('/admin/products')}
                                                className="cursor-pointer p-3 hover:bg-gray-100 transition-colors focus:bg-gray-100"
                                            >
                                                <div className="flex items-start gap-3 w-full">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${item.stock === 0 ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                                                        <HugeiconsIcon icon={item.stock === 0 ? CancelCircleIcon : Alert01Icon}
                                                            className={`text-xl ${item.stock === 0 ? 'text-red-500' : 'text-amber-500'}`}
                                                         />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                                        <p className={`text-xs mt-0.5 ${item.stock === 0 ? 'text-red-500' : 'text-amber-500'}`}>
                                                            {item.stock === 0
                                                                ? t('topbar.notifOutOfStock')
                                                                : t('topbar.notifLowStock', { count: item.stock })}
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        variant="outline"
                                                        className={`flex-shrink-0 ${item.stock === 0
                                                            ? 'text-red-500 border-red-500/30 bg-red-500/10'
                                                            : 'text-amber-500 border-amber-500/30 bg-amber-500/10'}`}
                                                    >
                                                        {item.stock}
                                                    </Badge>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                )
                            )}
                            {activeNotifTab === "batches" && (
                                expiringBatches.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                                        <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-3xl text-green-500"  />
                                        </div>
                                        <p className="text-sm font-medium text-gray-700">All batches are fresh</p>
                                        <p className="text-xs text-gray-500 mt-1">No batches nearing expiry</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-200">
                                        {expiringBatches.map((batch: any) => (
                                            <DropdownMenuItem
                                                key={batch.batch_uuid}
                                                onClick={() => navigate('/admin/products')}
                                                className="cursor-pointer p-3 hover:bg-gray-100 transition-colors focus:bg-gray-100"
                                            >
                                                <div className="flex items-start gap-3 w-full">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${batch.days_left <= 0 ? 'bg-red-500/20' : batch.days_left <= 30 ? 'bg-orange-500/20' : 'bg-yellow-500/20'}`}>
                                                        <HugeiconsIcon icon={CancelCircleIcon}
                                                            className={`text-xl ${batch.days_left <= 0 ? 'text-red-500' : batch.days_left <= 30 ? 'text-orange-500' : 'text-yellow-500'}`}
                                                         />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{batch.product_name}</p>
                                                        <p className="text-xs text-gray-400 mt-0.5">Batch: {batch.batch_number}</p>
                                                        <p className={`text-xs mt-0.5 ${batch.days_left <= 0 ? 'text-red-500' : batch.days_left <= 30 ? 'text-orange-500' : 'text-yellow-500'}`}>
                                                            {batch.days_left <= 0
                                                                ? 'Expired'
                                                                : `${batch.days_left} days left`}
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        variant="outline"
                                                        className={`flex-shrink-0 ${batch.days_left <= 0
                                                            ? 'text-red-500 border-red-500/30 bg-red-500/10'
                                                            : batch.days_left <= 30
                                                                ? 'text-orange-500 border-orange-500/30 bg-orange-500/10'
                                                                : 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10'}`}
                                                    >
                                                        {batch.remaining_qty}
                                                    </Badge>
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                )
                            )}
                        </ScrollArea>
                        {(activeNotifTab === "medicine" && lowStockItems.length > 0) || (activeNotifTab === "batches" && expiringBatches.length > 0) ? (
                            <>
                                <DropdownMenuSeparator className="bg-gray-200" />
                                <div className="px-3 py-2">
                                    <button
                                        onClick={handleClearNotifs}
                                        className="w-full py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        Clear All Notifications
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-gray-100 rounded-full transition-colors border border-gray-300 focus-visible:ring-0 focus-visible:ring-offset-0">
                            <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="hidden lg:block text-left">
                                <div className="text-sm font-semibold text-gray-800">{user?.name}</div>
                                <div className="text-xs text-gray-500 capitalize">{getRoleTranslation(user?.role)}</div>
                            </div>
                            <svg className="hidden lg:block w-4 h-4 text-gray-500 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 bg-white text-black border border-gray-200 shadow-2xl p-2">
                        <DropdownMenuLabel className="px-3 py-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-200" />
                        <DropdownMenuItem
                            onClick={() => handleNavigate('/admin/settings')}
                            className="cursor-pointer gap-3 px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            <HugeiconsIcon icon={UserCircleIcon} className="text-lg text-gray-500"  />
                            <span>{t('topbar.yourProfile')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => handleNavigate('/admin/settings')}
                            className="cursor-pointer gap-3 px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            <HugeiconsIcon icon={Settings01Icon} className="text-lg text-gray-500"  />
                            <span>{t('topbar.settingsDropdown')}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}