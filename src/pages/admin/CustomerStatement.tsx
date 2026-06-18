import { useTranslation } from 'react-i18next';

export default function CustomerStatement({ customer, ledger }: any) {
  const { t } = useTranslation();

  const totalDebit = ledger
    .filter((l: any) => l.type === "sale")
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0);

  const totalCredit = ledger
    .filter((l: any) => l.type === "payment")
    .reduce((sum: number, l: any) => sum + Number(l.amount), 0);

  // Map transaction types to translated labels
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'sale':
        return t('customerStatement.saleType');
      case 'payment':
        return t('customerStatement.paymentType');
      default:
        return type;
    }
  };

  return (
    <div className="p-6 text-sm">
      <h1 className="text-xl font-bold mb-2">{t('customerStatement.title')}</h1>

      <div className="mb-4">
        <div>{customer.name}</div>
        <div>{customer.mobile}</div>
      </div>

      <div className="mb-4">
        <div>{t('customerStatement.totalSales')} ₹{totalDebit}</div>
        <div>{t('customerStatement.totalPayments')} ₹{totalCredit}</div>
        <div className="font-bold">
          {t('customerStatement.balance')} ₹{totalDebit - totalCredit}
        </div>
      </div>

      <div className="table-scroll"><table className="w-full border text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2">{t('customerStatement.tableDate')}</th>
            <th className="p-2">{t('customerStatement.tableType')}</th>
            <th className="p-2">{t('customerStatement.tableNote')}</th>
            <th className="p-2 text-right">{t('customerStatement.tableAmount')}</th>
          </tr>
        </thead>

        <tbody>
          {ledger.map((l: any) => (
            <tr key={l.id} className="border-b">
              <td className="p-2">
                {new Date(l.created_at).toLocaleDateString()}
              </td>
              <td className="p-2">{getTypeLabel(l.type)}</td>
              <td className="p-2">{l.note}</td>
              <td className="p-2 text-right">
                ₹{Number(l.amount).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
