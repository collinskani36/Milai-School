import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dtumdjzpugggsbtmhlsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0dW1kanpwdWdnZ3NidG1obHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNzAwNjgsImV4cCI6MjA3MTk0NjA2OH0.eccSmytNnAdA6OxxWKufItVnNpVo77j6qa4ZSJkU6Bg';

export const supabase = createClient(supabaseUrl, supabaseKey);
 