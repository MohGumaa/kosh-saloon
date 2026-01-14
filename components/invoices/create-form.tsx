import Link from 'next/link';
import { ServiceField, StaffField } from '@/types';
import { Check, CircleDollarSign, CircleUser, Clock } from 'lucide-react';

import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function Form({ staffs, services }: { staffs: StaffField[], services: ServiceField[] }) {
  return (
    <form>
      <div className="rounded-md bg-gray-50 dark:bg-white/10 p-4 md:p-6">

        <div className="mb-5">
          <Label htmlFor="staff">أختر الموظف</Label>
          <div className="relative mt-2">
            <Select dir='rtl'>
              <SelectTrigger className="w-full">
                <div className="relative">
                  <SelectValue placeholder="أسم الموظف" className='pr-10'/>
                  <CircleUser className="pointer-events-none absolute right-1 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-500 peer-focus:text-gray-900 dark:peer-focus:text-gray-500" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {staffs.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-5">
          <Label htmlFor="service">أختر الخدمة</Label>
          <div className="relative mt-2">
            <Select dir='rtl'>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="نوع الخدمة" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>{service.name_ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Invoice Amount */}
        <div className="mb-5">
          <Label htmlFor="amount">سعر الخدمة</Label>
          <div className="relative mt-2 rounded-md">
            <div className="relative">
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                placeholder="أدخل مبلغ بالدرهم الإماراتي"
                className="w-full rounded-md peer placeholder:text-gray-500 dark:placeholder:text-white/50 pr-10 focus-visible:border-blue-500 focus-visible:ring-0 h-9.5"
              />
              <CircleDollarSign className="pointer-events-none absolute right-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-500 dark:text-white/50 peer-focus:text-gray-900 dark:peer-focus:text-gray-500" />
            </div>
          </div>
        </div>

        {/* Invoice Status */}
        <fieldset>
          <legend className="mb-2 block text-sm font-medium">
            حدد حالة الفاتورة
          </legend>
          <div className="rounded-md border border-gray-200 bg-white dark:bg-black/30 px-3.5 py-3">
            <div className="flex gap-4">
              <div className="flex items-center gap-x-2">
                <Input 
                  id="pending"
                  name="status"
                  type="radio"
                  value="pending"
                  className="h-4 w-4 cursor-pointer focus:ring-2"
                />
                <label
                  htmlFor="pending"
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600"
                >
                  غير مدفوعة <Clock className="h-4 w-4" />
                </label>
              </div>
              <div className="flex items-center gap-x-2">
                <input
                  id="paid"
                  name="status"
                  type="radio"
                  value="paid"
                  className="h-4 w-4 cursor-pointer border-gray-300 bg-gray-100 text-gray-600 focus:ring-2"
                />
                <label
                  htmlFor="paid"
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-green-500 px-3 py-1.5 text-xs font-medium text-white"
                >
                  مدفوعة <Check className="h-4 w-4" />
                </label>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
      <div className="mt-6 flex justify-end gap-4">
        <Link
          href="/dashboard/invoices"
          className="flex h-10 items-center rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          الغاء
        </Link>
        <Button type="submit">إنشاء فاتورة</Button>
      </div>
    </form>
  );
}
