import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  reportTitle: {
    fontSize: 14,
    marginTop: 5,
    color: '#374151',
  },
  period: {
    fontSize: 10,
    marginTop: 5,
    color: '#6b7280',
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#111827',
    color: '#111827',
    marginBottom: 10,
  },
  table: {
    width: 'auto',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableCellLabel: {
    flex: 2,
    textAlign: 'left',
    color: '#4b5563',
  },
  tableCellValue: {
    flex: 1,
    textAlign: 'right',
    fontWeight: 'bold',
    color: '#111827',
  },
  summarySection: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  summaryValue: {
    fontSize: 12,
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
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  divider: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  }
});

interface PLReportProps {
  stats: any;
  company?: any;
  dateRange: { start: string; end: string };
}

const formatCurrencyPDF = (amount: number) => {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${amount < 0 ? '-' : ''}Rs. ${formatted}`;
};

const formatDatePDF = (date: string) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

export const PLReportPDF = ({ stats, company, dateRange }: PLReportProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.companyName}>{company?.name || 'MAA'}</Text>
        <Text style={styles.reportTitle}>Profit & Loss Statement (Financial Report)</Text>
        <Text style={styles.period}>
          Reporting Period: {dateRange.start ? formatDatePDF(dateRange.start) : 'All Time'} - {dateRange.end ? formatDatePDF(dateRange.end) : 'Present'}
        </Text>
      </View>

      {/* Operating Revenue */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>1. OPERATING REVENUE</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Taxable Sales Revenue (Received, Excl. GST)</Text>
            <Text style={styles.tableCellValue}>{formatCurrencyPDF(stats.totalRevenue)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>GST Collected (Output Tax — payable to govt.)</Text>
            <Text style={styles.tableCellValue}>{formatCurrencyPDF(stats.gstCollected || 0)}</Text>
          </View>
        </View>
      </View>

      {/* Direct Costs & Expenses */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>2. DIRECT COSTS & EXPENSES</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Cost of Goods Sold (Inventory Consumption)</Text>
            <Text style={styles.tableCellValue}>{formatCurrencyPDF(stats.totalCOGS)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Operational & Business Expenses</Text>
            <Text style={styles.tableCellValue}>{formatCurrencyPDF(stats.totalExpenses)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Inventory Loss (Deadstock/Damage)</Text>
            <Text style={styles.tableCellValue}>{formatCurrencyPDF(stats.deadstockLoss)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCellLabel}>Tax Paid on Purchases (Input Tax Credit)</Text>
            <Text style={styles.tableCellValue}>{formatCurrencyPDF(0)}</Text>
          </View>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summarySection}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>GROSS PROFIT</Text>
          <Text style={[styles.summaryValue, stats.grossProfit >= 0 ? styles.profit : styles.loss]}>
            {formatCurrencyPDF(stats.grossProfit)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>NET PROFIT (After All Deductions)</Text>
          <Text style={[styles.summaryValue, stats.profit >= 0 ? styles.profit : styles.loss]}>
            {formatCurrencyPDF(stats.profit)}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.divider]}>
          <Text style={styles.summaryLabel}>PROFIT MARGIN</Text>
          <Text style={styles.summaryValue}>
            {stats.totalRevenue > 0 ? ((stats.profit / stats.totalRevenue) * 100).toFixed(2) : '0.00'}%
          </Text>
        </View>
      </View>

      {/* Taxation Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>3. TAXATION SUMMARY</Text>
        <View style={styles.tableRow}>
          <Text style={styles.tableCellLabel}>Net GST Payable (Output Tax − Input Credit)</Text>
          <Text style={styles.tableCellValue}>{formatCurrencyPDF(stats.gstCollected || 0)}</Text>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        This is a computer-generated document. Generated on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')} | {company?.name || 'MAA'}
      </Text>
    </Page>
  </Document>
);