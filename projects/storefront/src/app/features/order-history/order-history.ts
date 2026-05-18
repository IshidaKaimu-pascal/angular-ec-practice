import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Order, PaymentMethod } from 'shared';
import { OrderService } from '../../services/order.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-order-history',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatExpansionModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './order-history.html',
  styleUrl: './order-history.scss',
})
export class OrderHistory implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly authService = inject(AuthService);

  // 注文履歴の状態を signal で管理
  protected readonly orders = signal<Order[]>([]);

  ngOnInit(): void {
    // 現在のユーザーIDで履歴を絞り込み取得
    const userId = this.authService.currentUser().id;
    this.orderService.getAll(userId).subscribe({
      next: (data) => this.orders.set(data),
      error: (err) => console.error('購入履歴の取得に失敗:', err),
    });
  }

  //引数の支払方法によって表示を変える
  formatPaymentMethod(method:PaymentMethod): string{
    switch (method){
      case 'cash_on_delivery':return '代金引換';
      case 'convenience_store_payment':return 'コンビニ決済';
    }
  }

}
