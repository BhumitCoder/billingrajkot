import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Product } from '@/types';
import { calculateSellingPriceFromCommission } from '@/lib/billUtils';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  reportTitle: {
    fontSize: 14,
    marginTop: 5,
    color: '#374151',
  },
  period: {
    fontSize: 9,
    marginTop: 5,
    color: '#6b7280',
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    backgroundColor: '#f3f4f6',
    padding: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#111827',
    color: '#111827',
    marginBottom: 8,
  },
  table: {
    width: 'auto',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomColor: '#d1d5db',
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontWeight: 'bold',
  },
  tableCellLabel: {
    flex: 2,
    textAlign: 'left',
    color: '#4b5563',
    fontSize: 9,
  },
  tableCellValue: {
    flex: 1,
    textAlign: 'right',
    fontWeight: 'bold',
    color: '#111827',
    fontSize: 9,
  },
  tableCell: {
    flex: 1,
    textAlign: 'left',
    fontSize: 8,
    color: '#374151',
  },
  tableCellRight: {
    flex: 1,
    textAlign: 'right',
    fontSize: 8,
    color: '#374151',
  },
  summaryBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  profit: {
    color: '#059669',
  },
  loss: {
    color: '#dc2626',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 7,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  rankBadge: {
    width: 20,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: 'bold',
  },
  productName: {
    flex: 3,
    fontSize: 8,
    color: '#374151',
  },
  metric: {
    flex: 1,
    textAlign: 'right',
    fontSize: 8,
    color: '#374151',
  },
});

interface ProductsPDFProps {
  products: Product[];
  stats: any;
  averagePrices: Record<string, number>;
  currentAveragePrices: Record<string, number>;
  stockValues: Record<string, number>;
  companyProfile?: any;
}

const formatCurrency = (amount: number) => {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${amount < 0 ? '-' : ''}Rs. ${formatted}`;
};

export const ProductsPDF = ({ 
  products, 
  stats, 
  averagePrices,
  currentAveragePrices, 
  stockValues, 
  companyProfile 
}: ProductsPDFProps) => (
  <Document>
    {/* PAGE 1: INVENTORY SUMMARY */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.companyName}>{companyProfile?.name || 'INVENTORY REPORT'}</Text>
        <Text style={styles.reportTitle}>Complete Inventory Analysis</Text>
        <Text style={styles.period}>
          Generated: {new Date().toLocaleDateString('en-IN', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>

      {/* Overview Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>INVENTORY OVERVIEW</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Products</Text>
            <Text style={styles.tableCellValue}>{stats.totalProducts}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Stock Units</Text>
            <Text style={styles.tableCellValue}>{stats.totalStock.toFixed(2)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Inventory Value</Text>
            <Text style={styles.tableCellValue}>{formatCurrency(stats.totalInventoryValue)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Value with Commission</Text>
            <Text style={styles.tableCellValue}>{formatCurrency(stats.totalValueWithCommission)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Total Profit Potential</Text>
            <Text style={[styles.tableCellValue, styles.profit]}>
              {formatCurrency(stats.totalProfitPotential)}
            </Text>
          </View>
        </View>
      </View>

      {/* Pricing Averages */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PRICING AVERAGES</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Average Purchase Price</Text>
            <Text style={styles.tableCellValue}>{formatCurrency(stats.averagePurchasePrice)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Average with Commission</Text>
            <Text style={styles.tableCellValue}>{formatCurrency(stats.averageWithCommission)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Average Margin</Text>
            <Text style={[styles.tableCellValue, styles.profit]}>
              {formatCurrency(stats.averageMargin)}
            </Text>
          </View>
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.summaryBox}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Average Margin Percentage</Text>
          <Text style={[styles.summaryValue, styles.profit]}>
            {stats.averageMarginPercent.toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* Low Stock Alert */}
      {products.filter(p => p.stock < 10).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>LOW STOCK ALERT</Text>
          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={styles.productName}>Product</Text>
              <Text style={styles.metric}>Stock</Text>
              <Text style={styles.metric}>Unit</Text>
            </View>
            {products.filter(p => p.stock < 10).slice(0, 8).map((product) => (
              <View key={product.id} style={styles.tableRow}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={[styles.metric, styles.loss]}>{product.stock.toFixed(2)}</Text>
                <Text style={styles.metric}>{product.unit}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.footer}>
        {companyProfile?.name || 'Company'} | Page 1 | {new Date().toLocaleDateString('en-IN')}
      </Text>
    </Page>

    {/* PAGE 2: TOP PRODUCTS BY VALUE */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.companyName}>{companyProfile?.name || 'INVENTORY REPORT'}</Text>
        <Text style={styles.reportTitle}>Top Products by Stock Value</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>TOP 20 PRODUCTS BY STOCK VALUE</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={styles.rankBadge}>#</Text>
            <Text style={styles.productName}>Product Name</Text>
            <Text style={styles.metric}>Stock</Text>
            <Text style={styles.metric}>Value</Text>
          </View>
          {[...products]
            .sort((a, b) => (stockValues[b.id] || 0) - (stockValues[a.id] || 0))
            .slice(0, 20)
            .map((product, index) => (
              <View key={product.id} style={styles.tableRow}>
                <Text style={styles.rankBadge}>{index + 1}</Text>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.metric}>{product.stock.toFixed(2)}</Text>
                <Text style={[styles.metric, styles.profit]}>
                  {formatCurrency(stockValues[product.id] || 0)}
                </Text>
              </View>
            ))}
        </View>
      </View>

      <Text style={styles.footer}>
        {companyProfile?.name || 'Company'} | Page 2 | {new Date().toLocaleDateString('en-IN')}
      </Text>
    </Page>

    {/* PAGE 3: TOP PRODUCTS BY COMMISSION MARGIN */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.companyName}>{companyProfile?.name || 'INVENTORY REPORT'}</Text>
        <Text style={styles.reportTitle}>Top Products by Commission Margin</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>TOP 20 PRODUCTS BY COMMISSION MARGIN</Text>
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={styles.rankBadge}>#</Text>
            <Text style={styles.productName}>Product Name</Text>
            <Text style={styles.metric}>Purchase</Text>
            <Text style={styles.metric}>With Commission</Text>
            <Text style={styles.metric}>Margin %</Text>
          </View>
          {[...products]
            .map(p => {
              const currentAvgPrice = currentAveragePrices[p.id] || p.purchasePrice || 0;
              const commissionPrice = calculateSellingPriceFromCommission(
                currentAvgPrice,
                companyProfile?.commissionSettings,
              );
              const margin = currentAvgPrice > 0 ? ((commissionPrice - currentAvgPrice) / currentAvgPrice) * 100 : 0;
              return { ...p, margin, currentAvgPrice, commissionPrice };
            })
            .sort((a, b) => b.margin - a.margin)
            .slice(0, 20)
            .map((product, index) => (
              <View key={product.id} style={styles.tableRow}>
                <Text style={styles.rankBadge}>{index + 1}</Text>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.metric}>{formatCurrency(product.currentAvgPrice)}</Text>
                <Text style={styles.metric}>{formatCurrency(product.commissionPrice)}</Text>
                <Text style={[styles.metric, styles.profit]}>
                  {product.margin.toFixed(1)}%
                </Text>
              </View>
            ))}
        </View>
      </View>

      <Text style={styles.footer}>
        {companyProfile?.name || 'Company'} | Page 3 | {new Date().toLocaleDateString('en-IN')}
      </Text>
    </Page>

    {/* Complete Product List - Multi-page */}
    {Array.from({ length: Math.ceil(products.length / 25) }).map((_, pageIndex) => (
      <Page key={`page-${pageIndex + 4}`} size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyProfile?.name || 'INVENTORY REPORT'}</Text>
          <Text style={styles.reportTitle}>Complete Product List (Part {pageIndex + 1})</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableRowHeader}>
              <Text style={[styles.tableCell, { flex: 2 }]}>Name</Text>
              <Text style={styles.tableCellRight}>Stock</Text>
              <Text style={styles.tableCellRight}>Value</Text>
            </View>
            {products.slice(pageIndex * 25, (pageIndex + 1) * 25).map((product) => (
              <View key={product.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{product.name}</Text>
                <Text style={styles.tableCellRight}>{product.stock.toFixed(2)}</Text>
                <Text style={styles.tableCellRight}>
                  {formatCurrency(stockValues[product.id] || 0)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          {companyProfile?.name || 'Company'} | Page {pageIndex + 4} | {new Date().toLocaleDateString('en-IN')}
        </Text>
      </Page>
    ))}
  </Document>
);
