'use client';

// /invoices/[id] — generated GST tax invoice document (printable).
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { INVOICE_DOC } from '@/lib/gql';
import { Icon, Badge, Back, Mono, fmtINR } from '@/components/ui';

export default function InvoiceDocPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data } = useQuery(INVOICE_DOC, { variables: { invoiceId: id } });
  const d = data?.getAdminInvoiceDoc;
  if (!d)
    return (
      <div className="page">
        <div className="muted" style={{ padding: 40 }}>
          Loading invoice…
        </div>
      </div>
    );
  const inv = d.invoice;
  const seller = d.seller || {};
  const buyer = d.buyer || {};

  return (
    <div className="page">
      <div className="row between no-print" style={{ marginBottom: 18 }}>
        <Back label="All invoices" onClick={() => router.push('/invoices')} />
        <button className="btn btn-dark" onClick={() => window.print()}>
          <Icon name="download" size={16} />
          Print / PDF
        </button>
      </div>

      <div className="inv-doc">
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 30 }}>
          <div>
            <div className="row gap8" style={{ alignItems: 'baseline' }}>
              <span className="brand-word" style={{ fontSize: 22 }}>
                spotlyte.
              </span>
              <span className="brand-tag">tax invoice</span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
              {seller.name}
              <br />
              {seller.address}
              <br />
              GSTIN <Mono>{seller.gstin}</Mono> · PAN <Mono>{seller.pan}</Mono>
            </div>
          </div>
          <div className="right">
            <div className="eyebrow">INVOICE</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
              {inv.invoiceId}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Issued {inv.issued}
            </div>
            <div style={{ marginTop: 8 }}>
              <Badge status={inv.status} />
            </div>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              BILLED TO
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{buyer.name}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.6 }}>
              {buyer.contact && (
                <>
                  {buyer.contact}
                  <br />
                </>
              )}
              {buyer.email && (
                <>
                  {buyer.email}
                  <br />
                </>
              )}
              {buyer.city}
              {buyer.gstin && (
                <>
                  <br />
                  GSTIN <Mono>{buyer.gstin}</Mono>
                </>
              )}
            </div>
          </div>
          <div className="right">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              DETAILS
            </div>
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
              Type · <b style={{ color: 'var(--ink)' }}>{inv.type}</b>
              <br />
              Period · <b style={{ color: 'var(--ink)' }}>{inv.period}</b>
              <br />
              Due · <b style={{ color: 'var(--ink)' }}>{inv.due}</b>
            </div>
          </div>
        </div>

        <table className="tbl" style={{ marginBottom: 8 }}>
          <thead>
            <tr>
              <th>Description</th>
              <th className="num-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(d.lines || []).map((l, i) => (
              <tr key={i}>
                <td>{l.desc}</td>
                <td className="num-col strong">{fmtINR(l.amount, { full: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row between" style={{ padding: '16px 16px 0', borderTop: '1px solid var(--line)' }}>
          <span style={{ fontWeight: 600 }}>Total (incl. GST)</span>
          <span className="num" style={{ fontSize: 22 }}>
            {fmtINR(inv.total, { full: true })}
          </span>
        </div>

        <div className="muted" style={{ fontSize: 11.5, marginTop: 30, paddingTop: 16, borderTop: '1px solid var(--line-soft)', lineHeight: 1.6 }}>
          {d.notes}
          <br />
          This is a computer-generated invoice and does not require a signature. · {seller.email}
        </div>
      </div>
    </div>
  );
}
