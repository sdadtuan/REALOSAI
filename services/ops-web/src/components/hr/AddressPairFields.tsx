'use client';

import type { HrStaffAddressDto } from '@/lib/hr-employee-file-api';

type Props = {
  permanent: HrStaffAddressDto;
  temporary: HrStaffAddressDto;
  canEdit: boolean;
  onPermanentChange: (next: HrStaffAddressDto) => void;
  onTemporaryChange: (next: HrStaffAddressDto) => void;
};

function AddressFields({
  title,
  value,
  disabled,
  onChange,
}: {
  title: string;
  value: HrStaffAddressDto;
  disabled?: boolean;
  onChange: (next: HrStaffAddressDto) => void;
}) {
  return (
    <div className="hr-address-block">
      <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.9rem' }}>{title}</h4>
      <div className="form-grid form-grid--2">
        <label className="form-field">
          <span className="form-label">Số nhà, đường</span>
          <input
            className="form-input"
            value={value.line1 ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, line1: e.target.value })}
          />
        </label>
        <label className="form-field">
          <span className="form-label">Mã tỉnh/TP</span>
          <input
            className="form-input"
            value={value.province_code ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, province_code: e.target.value })}
          />
        </label>
        <label className="form-field">
          <span className="form-label">Mã quận/huyện</span>
          <input
            className="form-input"
            value={value.district_code ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, district_code: e.target.value })}
          />
        </label>
        <label className="form-field">
          <span className="form-label">Mã phường/xã</span>
          <input
            className="form-input"
            value={value.ward_code ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, ward_code: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

export function AddressPairFields({
  permanent,
  temporary,
  canEdit,
  onPermanentChange,
  onTemporaryChange,
}: Props) {
  const sameAsPermanent = Boolean(temporary.same_as_permanent);

  return (
    <div className="stack-gap">
      <AddressFields title="Thường trú" value={permanent} disabled={!canEdit} onChange={onPermanentChange} />
      <label className="form-check" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={sameAsPermanent}
          disabled={!canEdit}
          onChange={(e) => {
            const checked = e.target.checked;
            onTemporaryChange({
              ...temporary,
              same_as_permanent: checked,
              ...(checked
                ? {
                    line1: permanent.line1,
                    province_code: permanent.province_code,
                    district_code: permanent.district_code,
                    ward_code: permanent.ward_code,
                  }
                : {}),
            });
          }}
        />
        <span>Giống thường trú</span>
      </label>
      <AddressFields
        title="Tạm trú"
        value={temporary}
        disabled={!canEdit || sameAsPermanent}
        onChange={onTemporaryChange}
      />
    </div>
  );
}

export function emptyAddress(kind: HrStaffAddressDto['kind']): HrStaffAddressDto {
  return {
    kind,
    line1: '',
    province_code: '',
    district_code: '',
    ward_code: '',
    same_as_permanent: false,
  };
}

export function pickAddress(addresses: HrStaffAddressDto[], kind: HrStaffAddressDto['kind']): HrStaffAddressDto {
  return addresses.find((a) => a.kind === kind) ?? emptyAddress(kind);
}
