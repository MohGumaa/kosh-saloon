import Link from 'next/link';
import { createInvoice } from '@/lib/actions';
import { ServiceField, StaffField } from '@/types';
import { Check, CircleDollarSign, Clock } from 'lucide-react';

import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export default function Form({ staffs, services }: { staffs: StaffField[], services: ServiceField[] }) {
  return (
    <form action={createInvoice}>
      <div className="rounded-md bg-gray-50 dark:bg-white/10 p-4 md:p-6">

        <div className="mb-5">
          <Label htmlFor="staffId">أختر الموظف</Label>
          <div className="relative mt-2">
            <Select name="staffId" dir='rtl' required>
              <SelectTrigger className="w-full">
                <div className="relative">
                  <SelectValue placeholder="أسم الموظف" className='prr-10'/>
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
          <Label htmlFor="serviceId">أختر الخدمة</Label>
          <div className="relative mt-2">
            <Select name="serviceId" dir='rtl' required>
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
                step="5"
                placeholder="أدخل مبلغ بالدرهم الإماراتي"
                className="w-full rounded-md peer placeholder:text-gray-500 dark:placeholder:text-white/50 pr-10 focus-visible:border-blue-500 focus-visible:ring-0 h-9.5"
                required
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
          <div className="rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-black/15 px-3.5 py-3">
            <div className="flex gap-4">
              <div className="flex items-center gap-x-2">
                <Input 
                  id="pending"
                  name="status"
                  type="radio"
                  value="pending"
                  className="h-4 w-4 cursor-pointer focus:ring-2"
                />
                <Label
                  htmlFor="pending"
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-300"
                >
                  غير مدفوعة <Clock className="h-4 w-4" />
                </Label>
              </div>
              <div className="flex items-center gap-x-2">
                <Input
                  id="paid"
                  name="status"
                  type="radio"
                  value="paid"
                  defaultChecked
                  className="h-4 w-4 cursor-pointer focus:ring-2"
                />
                <Label
                  htmlFor="paid"
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-green-500 px-3 py-1.5 text-xs font-medium text-white"
                >
                  مدفوعة <Check className="h-4 w-4" />
                </Label>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
      <div className="mt-6 flex justify-end gap-4">
        <Button 
          type="submit"
          className='ks-btn ks-btn-primary h-10 text-white'
        >إنشاء فاتورة</Button>
        <Link
          href="/dashboard/invoices"
          className="flexCenter h-10 rounded-lg bg-gray-100 dark:bg-white/10 px-4 text-sm font-medium text-gray-500 dark:text-gray-300 transition-colors hover:bg-gray-200 dark:hover:bg-white/15"
        >
          الغاء
        </Link>
      </div>
    </form>
  );
}