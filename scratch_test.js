import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wpjplnifzwpuljjvvjqw.supabase.co';
const supabaseKey = 'sb_publishable_jtlAiAfARaUhQueWiEufPQ_pdfgR7zE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('Thử chèn dữ liệu mẫu...');
  
  const testPayload = {
    title: 'Khách sạn Thử Nghiệm',
    phone: '0987654321',
    address: '123 Đường Thử Nghiệm, Hà Nội',
    url: 'https://maps.google.com/test',
    totalScore: '4.5',
    website: 'https://test-hotel.com',
    list_name: 'Danh sách 123'
  };

  try {
    const { data, error } = await supabase
      .from('hotels')
      .insert(testPayload)
      .select();

    if (error) {
      console.log('Chèn thất bại, chi tiết lỗi:');
      console.log(JSON.stringify(error, null, 2));
    } else {
      console.log('Chèn THÀNH CÔNG!');
    }
  } catch (err) {
    console.error('Lỗi thực thi:', err);
  }
}

testInsert();
