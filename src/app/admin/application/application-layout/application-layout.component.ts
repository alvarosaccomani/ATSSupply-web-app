import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@services/auth';

@Component({
  selector: 'app-application-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './application-layout.component.html',
  styleUrl: './application-layout.component.scss'
})
export class ApplicationLayoutComponent {
  private readonly _authService = inject(AuthService);

  readonly currentUser = this._authService.currentUser;

  readonly userName = computed<string>(() => {
    const user = this.currentUser();
    if (!user) return 'Sysadmin';
    if (user.usr_name || user.usr_surname) {
      return `${user.usr_name || ''} ${user.usr_surname || ''}`.trim();
    }
    return user.usr_nick || user.usr_email || 'Sysadmin';
  });

  readonly userInitials = computed<string>(() => {
    const user = this.currentUser();
    if (!user) return 'SA';
    const first = user.usr_name ? user.usr_name.trim().charAt(0) : '';
    const last = user.usr_surname ? user.usr_surname.trim().charAt(0) : '';
    const initials = `${first}${last}`.toUpperCase();
    return initials || (user.usr_nick ? user.usr_nick.charAt(0).toUpperCase() : 'S');
  });

  public onLogout(): void {
    this._authService.logout();
  }
}
