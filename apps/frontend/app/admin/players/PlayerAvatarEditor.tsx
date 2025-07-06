import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getPlayerAvatarUrl, uploadPlayerAvatar, deletePlayerAvatar } from 'app/lib/api';
import { getCroppedImg } from './utils/cropImage';

export default function PlayerAvatarEditor({ player, accessToken, onAvatarChanged }: {
  player: any;
  accessToken?: string;
  onAvatarChanged?: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const openModal = () => {
    if (!accessToken) return;
    setModalOpen(true);
    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedImage(null);
    setCropping(false);
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(URL.createObjectURL(file));
    }
  };

  const handleCropSave = async () => {
    if (!selectedImage || !croppedAreaPixels || !player) return;
    setCropping(true);
    const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
    const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
    await uploadPlayerAvatar(player._id, croppedFile, accessToken);
    setCropping(false);
    closeModal();
    onAvatarChanged?.();
  };

  const handleDeleteAvatar = async () => {
    if (!player) return;
    await deletePlayerAvatar(player._id, accessToken);
    closeModal();
    onAvatarChanged?.();
  };

  return (
    <>
      <button
        onClick={openModal}
        className={accessToken ? 'focus:outline-none cursor-pointer' : 'focus:outline-none cursor-default'}
        disabled={!accessToken}
        title={accessToken ? 'Редактировать аватар' : undefined}
        tabIndex={0}
        type="button"
      >
        {player.photoUrl ? (
          <img src={getPlayerAvatarUrl(player.photoUrl)} alt="avatar" className="w-12 h-12 object-cover rounded-full mx-auto border-2 border-blue-400" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
        )}
      </button>
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg min-w-[340px] relative">
            <button className="absolute top-2 right-2 text-gray-500" onClick={closeModal}>&times;</button>
            <h2 className="text-lg font-bold mb-2 text-center">Аватар игрока</h2>
            <div className="text-center text-base font-semibold mb-4">{player.fullName}</div>
            {selectedImage ? (
              <div className="relative w-64 h-64 bg-gray-100 mx-auto">
                <Cropper
                  image={selectedImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center mb-4">
                {player.photoUrl ? (
                  <img src={getPlayerAvatarUrl(player.photoUrl)} alt="avatar" className="w-32 h-32 object-cover rounded-full border-2 border-blue-400 mb-2" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                )}
              </div>
            )}
            {accessToken && (
              <div className="flex gap-2 mt-4 justify-center">
                <button className="px-3 py-1 bg-red-500 text-white rounded flex items-center" onClick={handleDeleteAvatar} title="Удалить аватар">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  Удалить
                </button>
                <label className="px-3 py-1 bg-blue-600 text-white rounded flex items-center cursor-pointer" title="Загрузить новое фото">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
                  <input type="file" accept="image/*" className="hidden" onChange={handleSelectFile} />
                  Загрузить
                </label>
                {selectedImage && (
                  <button className="px-3 py-1 bg-green-600 text-white rounded flex items-center" onClick={handleCropSave} disabled={cropping} title="Сохранить">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {cropping ? 'Сохр...' : 'Сохранить'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
} 