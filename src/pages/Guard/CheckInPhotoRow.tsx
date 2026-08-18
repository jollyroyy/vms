// The identity strip on the check-in details screen: the face, the name, and
// which of the two ways the face got here.
//
// IT IS ALSO WHERE THE "DO NOT ASK TWICE" RULE IS VISIBLE (client instruction,
// 2026-08-18). A visitor photographed at walk-in registration reaches this step
// with a picture already on the row, and this strip states that rather than the
// camera opening again. `onRetake` renders only for a photo THIS desk just
// took — a picture already on the record is not this desk's to redo, and a
// "replace photo" control would be asking twice with a politer label.
import React from 'react';

type Props = {
  /** Captured a moment ago on this screen. */
  photoBlob: Blob | null;
  /** Already on the visit row (photo_data), when nothing was captured here. */
  photoOnFile: string | null;
  visitorName: string;
  departmentName: string;
  onRetake: () => void;
};

export default function CheckInPhotoRow({
  photoBlob, photoOnFile, visitorName, departmentName, onRetake,
}: Props): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <img
        src={photoBlob ? URL.createObjectURL(photoBlob) : (photoOnFile ?? '')}
        alt=""
        className="w-14 h-[72px] object-cover rounded-xl ring-2 ring-success-200"
      />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-navy-900">{visitorName}</p>
        <p className="text-sm text-navy-500 dark:text-navy-400 truncate">{departmentName}</p>
        <p className="text-xs text-success-600 font-semibold mt-1">
          {photoBlob ? 'Photo captured' : 'Photo already on file — taken when this visit was registered'}
        </p>
      </div>
      {photoBlob && (
        <button onClick={onRetake} className="text-danger-600 hover:text-danger-700 text-sm font-semibold shrink-0">
          Retake
        </button>
      )}
    </div>
  );
}
