import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function InternationalBill() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/bills', { replace: true }); }, [navigate]);
  return null;
}
